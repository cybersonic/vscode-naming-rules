class Logger {
    loggerName: string;

    constructor(loggerName: string) {
        this.loggerName = loggerName;
    }

    log(message: string | any | any[]) {
        console.log(this.loggerName, message);
    }
    info(message: string | any | any[]) {
        console.info(this.loggerName, message);
    }
    warn(message: string | any | any[]) {
        console.warn(this.loggerName, message);
    }
    error(message: string | any | any[]) {
        console.error(this.loggerName, message);
    }
}

export default Logger;