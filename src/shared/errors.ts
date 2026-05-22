const ERR_PREFIX = "HIAI";

export const ErrorCodes = {
  AGENT_NOT_FOUND: `${ERR_PREFIX}_AGENT_NOT_FOUND`,
  AGENT_COMMUNICATION_FAILED: `${ERR_PREFIX}_AGENT_COMMUNICATION_FAILED`,
  AGENT_TIMEOUT: `${ERR_PREFIX}_AGENT_TIMEOUT`,

  CONFIG_INVALID: `${ERR_PREFIX}_CONFIG_INVALID`,
  CONFIG_MISSING_REQUIRED: `${ERR_PREFIX}_CONFIG_MISSING_REQUIRED`,
  CONFIG_LOAD_FAILED: `${ERR_PREFIX}_CONFIG_LOAD_FAILED`,

  HOOK_BLOCKED: `${ERR_PREFIX}_HOOK_BLOCKED`,
  HOOK_EXECUTION_FAILED: `${ERR_PREFIX}_HOOK_EXECUTION_FAILED`,

  MCP_CONNECTION_FAILED: `${ERR_PREFIX}_MCP_CONNECTION_FAILED`,
  MCP_SERVER_NOT_FOUND: `${ERR_PREFIX}_MCP_SERVER_NOT_FOUND`,
  MCP_INVALID_RESPONSE: `${ERR_PREFIX}_MCP_INVALID_RESPONSE`,

  TASK_NOT_FOUND: `${ERR_PREFIX}_TASK_NOT_FOUND`,
  TASK_SESSION_MISSING: `${ERR_PREFIX}_TASK_SESSION_MISSING`,
  TASK_PROMPT_FAILED: `${ERR_PREFIX}_TASK_PROMPT_FAILED`,
  TASK_DELEGATION_FAILED: `${ERR_PREFIX}_TASK_DELEGATION_FAILED`,

  IO_FILE_NOT_FOUND: `${ERR_PREFIX}_IO_FILE_NOT_FOUND`,
  IO_PERMISSION_DENIED: `${ERR_PREFIX}_IO_PERMISSION_DENIED`,
  IO_ARCHIVE_INVALID: `${ERR_PREFIX}_IO_ARCHIVE_INVALID`,

  VALIDATION_FAILED: `${ERR_PREFIX}_VALIDATION_FAILED`,
  VALIDATION_ARGUMENT_MISSING: `${ERR_PREFIX}_VALIDATION_ARGUMENT_MISSING`,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes] | string;

export class HiaiOpenCodeError extends Error {
  readonly code: string;
  readonly category: string;

  constructor(message: string, code: string, category: string) {
    super(message);
    this.name = "HiaiOpenCodeError";
    this.code = code;
    this.category = category;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HiaiOpenCodeError);
    }
  }

  toString(): string {
    return `[${this.code}] ${this.message}`;
  }
}

export class AgentError extends HiaiOpenCodeError {
  constructor(
    message: string,
    code: string = ErrorCodes.AGENT_COMMUNICATION_FAILED,
  ) {
    super(message, code, "agent");
    this.name = "AgentError";
  }

  static notFound(agentName: string): AgentError {
    return new AgentError(
      `Agent "${agentName}" is not registered or available`,
      ErrorCodes.AGENT_NOT_FOUND,
    );
  }

  static timeout(agentName: string, timeoutMs?: number): AgentError {
    const msg = timeoutMs
      ? `Agent "${agentName}" timed out after ${timeoutMs}ms`
      : `Agent "${agentName}" timed out`;
    return new AgentError(msg, ErrorCodes.AGENT_TIMEOUT);
  }

  static communicationFailed(agentName: string, cause: unknown): AgentError {
    const msg =
      cause instanceof Error
        ? `Failed to communicate with agent "${agentName}": ${cause.message}`
        : `Failed to communicate with agent "${agentName}": ${String(cause)}`;
    return new AgentError(msg, ErrorCodes.AGENT_COMMUNICATION_FAILED);
  }
}

export class ConfigError extends HiaiOpenCodeError {
  constructor(message: string, code: string = ErrorCodes.CONFIG_INVALID) {
    super(message, code, "config");
    this.name = "ConfigError";
  }

  static missingRequired(field: string): ConfigError {
    return new ConfigError(
      `Missing required configuration: ${field}`,
      ErrorCodes.CONFIG_MISSING_REQUIRED,
    );
  }

  static invalid(message: string): ConfigError {
    return new ConfigError(message, ErrorCodes.CONFIG_INVALID);
  }

  static loadFailed(path: string, cause: unknown): ConfigError {
    const msg =
      cause instanceof Error
        ? `Failed to load config from "${path}": ${cause.message}`
        : `Failed to load config from "${path}": ${String(cause)}`;
    return new ConfigError(msg, ErrorCodes.CONFIG_LOAD_FAILED);
  }
}

export class HookError extends HiaiOpenCodeError {
  constructor(
    message: string,
    code: string = ErrorCodes.HOOK_EXECUTION_FAILED,
  ) {
    super(message, code, "hook");
    this.name = "HookError";
  }

  static blocked(reason: string): HookError {
    return new HookError(
      `Hook blocked operation: ${reason}`,
      ErrorCodes.HOOK_BLOCKED,
    );
  }

  static executionFailed(hookName: string, cause: unknown): HookError {
    const msg =
      cause instanceof Error
        ? `Hook "${hookName}" execution failed: ${cause.message}`
        : `Hook "${hookName}" execution failed: ${String(cause)}`;
    return new HookError(msg, ErrorCodes.HOOK_EXECUTION_FAILED);
  }
}

export class McpError extends HiaiOpenCodeError {
  constructor(
    message: string,
    code: string = ErrorCodes.MCP_CONNECTION_FAILED,
  ) {
    super(message, code, "mcp");
    this.name = "McpError";
  }

  static connectionFailed(serverName: string, cause: unknown): McpError {
    const msg =
      cause instanceof Error
        ? `MCP server "${serverName}" connection failed: ${cause.message}`
        : `MCP server "${serverName}" connection failed: ${String(cause)}`;
    return new McpError(msg, ErrorCodes.MCP_CONNECTION_FAILED);
  }

  static serverNotFound(serverName: string): McpError {
    return new McpError(
      `MCP server "${serverName}" not found or not configured`,
      ErrorCodes.MCP_SERVER_NOT_FOUND,
    );
  }

  static invalidResponse(serverName: string, details: string): McpError {
    return new McpError(
      `MCP server "${serverName}" returned invalid response: ${details}`,
      ErrorCodes.MCP_INVALID_RESPONSE,
    );
  }
}

export class TaskError extends HiaiOpenCodeError {
  constructor(
    message: string,
    code: string = ErrorCodes.TASK_DELEGATION_FAILED,
  ) {
    super(message, code, "task");
    this.name = "TaskError";
  }

  static notFound(taskId: string): TaskError {
    return new TaskError(
      `Task not found: ${taskId}`,
      ErrorCodes.TASK_NOT_FOUND,
    );
  }

  static sessionMissing(taskId: string): TaskError {
    return new TaskError(
      `Task "${taskId}" has no session ID`,
      ErrorCodes.TASK_SESSION_MISSING,
    );
  }

  static promptFailed(agentName: string, cause: unknown): TaskError {
    const msg =
      cause instanceof Error
        ? `Failed to send prompt to "${agentName}": ${cause.message}`
        : `Failed to send prompt to "${agentName}": ${String(cause)}`;
    return new TaskError(msg, ErrorCodes.TASK_PROMPT_FAILED);
  }

  static delegationFailed(details: string): TaskError {
    return new TaskError(
      `Task delegation failed: ${details}`,
      ErrorCodes.TASK_DELEGATION_FAILED,
    );
  }
}

export class ValidationError extends HiaiOpenCodeError {
  constructor(message: string, code: string = ErrorCodes.VALIDATION_FAILED) {
    super(message, code, "validation");
    this.name = "ValidationError";
  }

  static missingArg(argumentName: string): ValidationError {
    return new ValidationError(
      `Missing required argument: '${argumentName}'`,
      ErrorCodes.VALIDATION_ARGUMENT_MISSING,
    );
  }

  static failed(details: string): ValidationError {
    return new ValidationError(
      `Validation failed: ${details}`,
      ErrorCodes.VALIDATION_FAILED,
    );
  }
}

export class IoError extends HiaiOpenCodeError {
  constructor(message: string, code: string = ErrorCodes.IO_FILE_NOT_FOUND) {
    super(message, code, "io");
    this.name = "IoError";
  }

  static fileNotFound(path: string): IoError {
    return new IoError(`File not found: ${path}`, ErrorCodes.IO_FILE_NOT_FOUND);
  }

  static permissionDenied(path: string): IoError {
    return new IoError(
      `Permission denied: ${path}`,
      ErrorCodes.IO_PERMISSION_DENIED,
    );
  }

  static archiveInvalid(details: string): IoError {
    return new IoError(
      `Invalid archive: ${details}`,
      ErrorCodes.IO_ARCHIVE_INVALID,
    );
  }
}
