export enum MessageSeverity {
    DEBUG_DETAIL = 0,
    DEBUG = 1,
    DEBUG_OVERVIEW = 2,
    WARNING = 3,
    ERROR = 4
}

/**
 * Settings of logger to filter the msssages.
 */
export interface ILoggerSettings {

    /**
     * If true, disables all logging.
     */
    disabled?: boolean;

    /**
     * List of components, which are allowed to appear in log.
     * If empty or null, all components are allowed (except those excplicitly denied).
     */
    allowedComponents?: string[];

    /**
     * Components, which never appear in the log
     */
    deniedComponents?: string[];

    /**
     * Messages with lower severity will not appear in log.
     */
    maxSeverity?: MessageSeverity;

    /**
     * Messages having more length will be cut off to this number.
     */
    maxMessageLength?: number;
}

export interface ILogger {
    /**
     * Logs a message
     * @param message - message text
     * @param severity - message severity
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    log(message: string, severity: MessageSeverity,
        component?: string, subcomponent?: string): void;

    /**
     * Logs a DEBUG severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    debug(message: string,
          component?: string, subcomponent?: string): void;

    /**
     * Logs a DEBUG_DETAIL severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    debugDetail(message: string,
                component?: string, subcomponent?: string): void;

    /**
     * Logs a DEBUG_OVERVIEW severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    debugOverview(message: string,
                  component?: string, subcomponent?: string): void;

    /**
     * Logs a WARNING severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    warning(message: string,
            component?: string, subcomponent?: string): void;

    /**
     * Logs an ERROR severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    error(message: string,
          component?: string, subcomponent?: string): void;

    /**
     * Sets logger configuration, both for the server and for the client.
     * @param loggerSettings
     */
    setLoggerConfiguration(loggerSettings: ILoggerSettings);
}
