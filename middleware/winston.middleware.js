const { createLogger, format, transports } = require('winston');
const LEVEL = Symbol.for('level');
const path = require('path');

const errorFile = path.join(__dirname, '../logs/', 'error.log');
const warnFile = path.join(__dirname, '../logs/', 'warn.log');
const infoFile = path.join(__dirname, '../logs/', 'info.log');
const verboseFile = path.join(__dirname, '../logs/', 'verbose.log');
const debugFile = path.join(__dirname, '../logs/', 'debug.log');
const sillyFile = path.join(__dirname, '../logs/', 'silly.log');
const mailFile = path.join(__dirname, '../logs/', 'mail.log');
const mailErrorFile = path.join(__dirname, '../logs/', 'mailError.log');

let customLevels = {
	mail: 0,
	error: 1,
	warn: 2,
	info: 3,
	verbose: 4,
	debug: 5,
	silly: 6
};

function filterOnly(level) {
	return format(function (info) {
		if (info[LEVEL] === level) {
			return info;
		}
	})();
}

// Create a new winston logger instance with two transports: Console, and File
const logger = createLogger({
	levels: customLevels,
  transports: [
    new transports.Console({ handleExceptions: false, level: 'info' }),
    new transports.File({ filename: errorFile, level: 'error', maxsize: 52428800, maxFiles: 50, format: filterOnly('error')}),
		new transports.File({ filename: warnFile, level: 'warn', maxsize: 52428800, maxFiles: 20, format: filterOnly('warn') }),
		new transports.File({ filename: infoFile, level: 'info', maxsize: 52428800, maxFiles: 20, format: filterOnly('info') }),
		new transports.File({ filename: verboseFile, level: 'verbose', maxsize: 52428800, maxFiles: 20, format: filterOnly('verbose') }),
		new transports.File({ filename: debugFile, level: 'debug', maxsize: 52428800, maxFiles: 20, format: filterOnly('debug') }),
		new transports.File({ filename: sillyFile, level: 'silly', maxsize: 52428800, maxFiles: 20, format: filterOnly('silly') }),
		new transports.File({ filename: mailFile, level: 'mail', maxsize: 52428800, maxFiles: 20, format: filterOnly('mail') }),
		new transports.File({ filename: mailErrorFile, level: 'mailError', maxsize: 52428800, maxFiles: 20, format: filterOnly('mailError') })
  ],
  exitOnError: false
});

logger.stream = {
	write: (message, encoding) => {
		logger.info(message);
	},
};
module.exports = 	logger;

