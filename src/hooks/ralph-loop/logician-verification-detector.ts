import { stripInvisibleAgentCharacters } from "../../shared/agent-display-names"
import { ULTRAWORK_VERIFICATION_PROMISE } from "./constants"

const VERIFICATION_GATE_AGENT_KEYS = new Set(["critic"])

export interface CriticVerificationEvidence {
	agent: string
	promise: string
	sessionID?: string
}

const AGENT_LINE_PATTERN = /^Agent:[ \t]*(\S+)$/im
const PROMISE_TAG_PATTERN = /<promise>[ \t]*(\S+?)[ \t]*<\/promise>/is
const TASK_METADATA_PATTERN = /<task_metadata>[ \t]*([\s\S]*?)[ \t]*<\/task_metadata>/is
const SESSION_ID_LINE_PATTERN = /^session_id:[ \t]*(\S+)$/im

function normalizeVerificationGateAgentKey(agentName: string): string {
	return stripInvisibleAgentCharacters(agentName).trim().toLowerCase()
}

function isVerificationGateAgent(agentName: string): boolean {
	return VERIFICATION_GATE_AGENT_KEYS.has(normalizeVerificationGateAgentKey(agentName))
}

export function parseCriticVerificationEvidence(text: string): CriticVerificationEvidence | undefined {
	const trimmedText = text.trim()
	if (!trimmedText) {
		return undefined
	}

	const agentMatch = trimmedText.match(AGENT_LINE_PATTERN)
	if (!agentMatch) {
		return undefined
	}
	const agent = agentMatch[1]?.trim()
	if (!agent) {
		return undefined
	}

	const promiseMatch = trimmedText.match(PROMISE_TAG_PATTERN)
	if (!promiseMatch) {
		return undefined
	}
	const promise = promiseMatch[1]?.trim()
	if (!promise) {
		return undefined
	}

	const metadataMatch = trimmedText.match(TASK_METADATA_PATTERN)
	let sessionID: string | undefined
	if (metadataMatch) {
		const metadataContent = metadataMatch[1]
		const sessionIDMatch = metadataContent.match(SESSION_ID_LINE_PATTERN)
		if (sessionIDMatch) {
			sessionID = sessionIDMatch[1]?.trim()
		}
	}

	return { agent, promise, sessionID }
}

export type LogicianVerificationEvidence = CriticVerificationEvidence

export const parseLogicianVerificationEvidence = parseCriticVerificationEvidence

export function isCriticVerified(text: string): boolean {
	const evidence = parseCriticVerificationEvidence(text)
	if (!evidence) {
		return false
	}

	const isVerifiedPromise = evidence.promise === ULTRAWORK_VERIFICATION_PROMISE

	return isVerificationGateAgent(evidence.agent) && isVerifiedPromise
}

export const isLogicianVerified = isCriticVerified

export function extractCriticSessionID(text: string): string | undefined {
	const evidence = parseCriticVerificationEvidence(text)
	if (!evidence || !isVerificationGateAgent(evidence.agent)) {
		return undefined
	}

	return evidence.sessionID
}

export const extractLogicianSessionID = extractCriticSessionID
