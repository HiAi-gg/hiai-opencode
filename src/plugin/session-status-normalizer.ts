type EventInput = { event: { type: string; properties?: Record<string, unknown> } }
type SessionStatus = { type: string; message?: string }

function isSummaryStatus(status: SessionStatus | undefined): boolean {
	if (!status) return false

	const message = typeof status.message === "string" ? status.message.toLowerCase() : ""
	return message.includes("summary") || message.includes("summariz") || message.includes("compress")
}

export function normalizeSessionStatusToIdle(input: EventInput): EventInput | null {
	if (input.event.type !== "session.status") return null

	const props = input.event.properties
	if (!props) return null

	const status = props.status as SessionStatus | undefined
	if (!status || status.type !== "idle") return null
	if (isSummaryStatus(status)) return null

	const sessionID = props.sessionID as string | undefined
	if (!sessionID) return null

	return {
		event: {
			type: "session.idle",
			properties: { sessionID },
		},
	}
}
