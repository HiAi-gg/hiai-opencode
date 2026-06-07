import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"
import type { RalphLoopOptions, RalphLoopState } from "./types"
import { HOOK_NAME } from "./constants"
import { getPlanProgress, findPlanNameForSession, readBoulderForPlan, syncBoulderNotepadsFromWorktree, deleteBoulderForPlan } from "../../features/boulder-state/storage"
import { handleDetectedCompletion } from "./completion-handler"
import {
	detectCompletionInSessionMessages,
	detectCompletionInTranscript,
} from "./completion-promise-detector"
import { continueIteration } from "./iteration-continuation"
import { handlePendingVerification } from "./pending-verification-handler"
import { handleDeletedLoopSession, handleErroredLoopSession } from "./session-event-handler"

type SessionRecovery = {
	isRecovering: (sessionID: string) => boolean
	markRecovering: (sessionID: string) => void
	clear: (sessionID: string) => void
}
type LoopStateController = {
	getState: () => RalphLoopState | null
	clear: () => boolean
	incrementIteration: () => RalphLoopState | null
	setSessionID: (sessionID: string) => RalphLoopState | null
	markVerificationPending: (sessionID: string) => RalphLoopState | null
	setVerificationSessionID: (sessionID: string, verificationSessionID: string) => RalphLoopState | null
	restartAfterFailedVerification: (sessionID: string, messageCountAtStart?: number) => RalphLoopState | null
}
type RalphLoopEventHandlerOptions = { directory: string; apiTimeoutMs: number; getTranscriptPath: (sessionID: string) => string | undefined; checkSessionExists?: RalphLoopOptions["checkSessionExists"]; sessionRecovery: SessionRecovery; loopState: LoopStateController; minimumIdleMs?: number }

export function createRalphLoopEventHandler(
	ctx: PluginInput,
	options: RalphLoopEventHandlerOptions,
) {
	const inFlightSessions = new Set<string>()
	const lastContinuationTime = new Map<string, number>()

	return async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		const props = event.properties as Record<string, unknown> | undefined

		if (event.type === "session.idle") {
			const sessionID = props?.sessionID as string | undefined
			if (!sessionID) return

			if (inFlightSessions.has(sessionID)) {
				log(`[${HOOK_NAME}] Skipped: handler in flight`, { sessionID })
				return
			}

			inFlightSessions.add(sessionID)

			try {

				if (options.sessionRecovery.isRecovering(sessionID)) {
					log(`[${HOOK_NAME}] Skipped: in recovery`, { sessionID })
					return
				}

				const state = options.loopState.getState()
				if (!state || !state.active) {
					return
				}

				const verificationSessionID = state.verification_pending
					? state.verification_session_id
					: undefined
				const matchesParentSession = state.session_id === undefined || state.session_id === sessionID
				const matchesVerificationSession = verificationSessionID === sessionID

				if (!matchesParentSession && !matchesVerificationSession && state.session_id) {
					if (options.checkSessionExists) {
						try {
							const exists = await options.checkSessionExists(state.session_id)
							if (!exists) {
								options.loopState.clear()
								log(`[${HOOK_NAME}] Cleared orphaned state from deleted session`, {
									orphanedSessionId: state.session_id,
									currentSessionId: sessionID,
								})
								return
							}
						} catch (err) {
							log(`[${HOOK_NAME}] Failed to check session existence`, {
								sessionId: state.session_id,
								error: String(err),
							})
						}
					}
					return
				}

				const completionSessionID = verificationSessionID ?? sessionID
				const transcriptPath = completionSessionID ? options.getTranscriptPath(completionSessionID) : undefined
				const completionViaTranscript = completionSessionID
					? detectCompletionInTranscript(
						transcriptPath,
						state.completion_promise,
						state.started_at,
					)
					: false
				const completionViaApi = completionViaTranscript
					? false
					: verificationSessionID
						? await detectCompletionInSessionMessages(ctx, {
							sessionID: verificationSessionID,
							promise: state.completion_promise,
							apiTimeoutMs: options.apiTimeoutMs,
							directory: options.directory,
							sinceMessageIndex: undefined,
						})
					: state.verification_pending
						? await detectCompletionInSessionMessages(ctx, {
							sessionID,
							promise: state.completion_promise,
							apiTimeoutMs: options.apiTimeoutMs,
							directory: options.directory,
							sinceMessageIndex: state.message_count_at_start,
						})
					: await detectCompletionInSessionMessages(ctx, {
						sessionID,
						promise: state.completion_promise,
						apiTimeoutMs: options.apiTimeoutMs,
						directory: options.directory,
						sinceMessageIndex: state.message_count_at_start,
					})

				if (completionViaTranscript || completionViaApi) {
					log(`[${HOOK_NAME}] Completion detected!`, {
						sessionID,
						iteration: state.iteration,
						promise: state.completion_promise,
						detectedVia: completionViaTranscript
							? "transcript_file"
							: "session_messages_api",
					})
					await handleDetectedCompletion(ctx, {
						sessionID,
						state,
						loopState: options.loopState,
						directory: options.directory,
						apiTimeoutMs: options.apiTimeoutMs,
					})
					return
				}

				if (state.verification_pending) {
					if (!verificationSessionID && matchesParentSession) {
						log(`[${HOOK_NAME}] Verification pending without tracked critic session, running recovery check`, {
							sessionID,
							iteration: state.iteration,
						})
					}

					await handlePendingVerification(ctx, {
						sessionID,
						state,
						verificationSessionID,
						matchesParentSession,
						matchesVerificationSession,
						loopState: options.loopState,
						directory: options.directory,
						apiTimeoutMs: options.apiTimeoutMs,
					})
					return
				}

				// Guard: exit loop if the plan has 0 tasks (empty or corrupted)
				const planName = findPlanNameForSession(options.directory, sessionID)
				if (planName) {
					try {
						const planFilePath = join(options.directory, ".bob", "plans", `${planName}.md`)
						const progress = getPlanProgress(planFilePath)
						if (progress && progress.total === 0) {
							log(`[${HOOK_NAME}] Empty plan detected (0 tasks), stopping loop`, {
								sessionID,
								planName,
								planFile: planFilePath,
							})
							options.loopState.clear()
							await ctx.client.tui?.showToast?.({
								body: {
									title: "Ralph Loop Stopped",
									message: `Plan "${planName}" has 0 tasks — nothing to execute.`,
									variant: "warning",
									duration: 5000,
								},
							}).catch(() => { /* intentionally ignored — toast is non-critical */ })
							return
						}
					} catch (err) {
						// getPlanProgress returns { total:0, isComplete:true } for missing files
						// Log but don't exit — file might not exist yet
						log(`[${HOOK_NAME}] Plan progress check failed, continuing`, {
							sessionID,
							planName,
							error: String(err),
						})
					}
				}

				{
					const planName = findPlanNameForSession(options.directory, sessionID)
					if (planName) {
						const planPath = join(options.directory, ".bob", "plans", `${planName}.md`)
						if (existsSync(planPath)) {
							const content = readFileSync(planPath, "utf-8")
							const hasCheckboxes = /- \[[ x]\]/.test(content)
							const hasNumberedTasks = /^\d+\.\s+\*\*Task/i.test(content)
							if (!hasCheckboxes && hasNumberedTasks) {
								log(`[${HOOK_NAME}] Plan file lacks checkboxes but has numbered tasks`, {
									planName,
									sessionID,
								})
								await ctx.client.tui?.showToast?.({
									body: {
										title: "Plan Format Warning",
										message: `Plan "${planName}" uses numbered tasks instead of checkboxes. The automation system requires \`- [ ]\` format.`,
										variant: "warning",
										duration: 8000,
									},
								}).catch(() => { /* intentionally ignored — toast is non-critical */ })
							}
						}
					}
				}

				if (
					typeof state.max_iterations === "number"
					&& state.iteration >= state.max_iterations
				) {
					log(`[${HOOK_NAME}] Max iterations reached`, {
						sessionID,
						iteration: state.iteration,
						max: state.max_iterations,
					})
					options.loopState.clear()

					await ctx.client.tui?.showToast?.({
						body: { title: "Ralph Loop Stopped", message: `Max iterations (${state.max_iterations}) reached without completion`, variant: "warning", duration: 5000 },
						}).catch(() => { /* intentionally ignored — toast is non-critical */ })
					return
				}

				// Check minimum idle delay before continuing
				const minIdleMs = options.minimumIdleMs ?? 120_000
				const lastTime = lastContinuationTime.get(sessionID) ?? 0
				const elapsed = Date.now() - lastTime
				if (elapsed < minIdleMs) {
					log(`[${HOOK_NAME}] Skipped: minimum idle delay not reached (${elapsed}ms < ${minIdleMs}ms)`, { sessionID })
					return
				}
				lastContinuationTime.set(sessionID, Date.now())

				const newState = options.loopState.incrementIteration()
				if (!newState) {
					log(`[${HOOK_NAME}] Failed to increment iteration`, { sessionID })
					return
				}

				log(`[${HOOK_NAME}] Continuing loop`, {
					sessionID,
					iteration: newState.iteration,
					max: newState.max_iterations,
				})

				await ctx.client.tui?.showToast?.({
					body: {
						title: "Ralph Loop",
						message: `Iteration ${newState.iteration}/${typeof newState.max_iterations === "number" ? newState.max_iterations : "unbounded"}`,
						variant: "info",
						duration: 2000,
					},
					}).catch(() => { /* intentionally ignored — toast is non-critical */ })

				try {
					await continueIteration(ctx, newState, {
						previousSessionID: sessionID,
						directory: options.directory,
						apiTimeoutMs: options.apiTimeoutMs,
						loopState: options.loopState,
					})
				} catch (err) {
					log(`[${HOOK_NAME}] Failed to inject continuation`, {
						sessionID,
						error: String(err),
					})
				}
				return
			} finally {
				inFlightSessions.delete(sessionID)
			}
		}

		if (event.type === "session.deleted") {
			if (!handleDeletedLoopSession(props, options.loopState, options.sessionRecovery)) return

			const deletedSessionID = (props as Record<string, unknown> | undefined)?.sessionID as string | undefined
			if (deletedSessionID) {
				const planName = findPlanNameForSession(options.directory, deletedSessionID)
				if (planName) {
					try {
						const planState = readBoulderForPlan(options.directory, planName)
						if (planState?.worktree_path) {
							syncBoulderNotepadsFromWorktree(options.directory, planState.worktree_path)
							deleteBoulderForPlan(options.directory, planName)
							log(`[${HOOK_NAME}] Synced notepads from deleted session worktree`, {
								sessionID: deletedSessionID,
								planName,
								worktreePath: planState.worktree_path,
							})
						}
					} catch (err) {
						log(`[${HOOK_NAME}] Failed to cleanup worktree on session deleted`, {
							error: String(err),
						})
					}
				}
			}
			return
		}

		if (event.type === "session.error") {
			handleErroredLoopSession(props, options.loopState, options.sessionRecovery)
		}
	}
}
