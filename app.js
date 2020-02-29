require('newrelic');
const dotenv = require('dotenv');
dotenv.config();
const env = process.env.NODE_ENV || 'development';

const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

const winston = require('./middleware/winston.middleware');

const dbConfig = require('./config/db.config.js')[env];
const cryptoConfig = require('./config/crypto.config.js')[env];
const jwtConfig = require('./config/jwt.config.js')[env];
const firebaseConfig = require('./config/firebase.config.js')[env];
const mixPanelConfig = require('./config/mixpanel.config.js')[env];
const mailConfig = require('./config/email.config.js')[env];
const sendGridConfig = require('./config/send-grid.config.js')[env];

const formatResponse = require('./helpers/response.helper').formatResponse;
const { InternalServerError, NotFound } = require('./constants/http-responses.constants');
const moment = require('moment');

const app = express();

app.disable('x-powered-by');

// CORS
app.use(cors());
app.disable('etag');

// Compression
app.use(compression());
app.use(helmet());



app.set('dbConfig', dbConfig);
app.set('firebaseConfig', firebaseConfig);
app.set('mixPanelConfig', mixPanelConfig);
app.set('sendGridConfig', sendGridConfig);
global.__base = __dirname;
global.__dbConfig = dbConfig;

global.__jwtConfig = jwtConfig;
global.__cryptoConfig = cryptoConfig;
global.__mailConfig = mailConfig;
global.__firebaseConfig = firebaseConfig;
global.__sendGridConfig = sendGridConfig;

require('./models');
require('./passport/supplier.passport');
const supplierRoutes = require('./routes/school.routes');

const rateLimit = require('express-rate-limit');

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
// app.set('trust proxy', 1);


const limiter = rateLimit({
	windowMs:  10 * 60 * 1000, // 1 minutes
	max: 200, // limit each IP to 100 requests per windowMs
	keyGenerator: function(req) {
		return req.headers['cf-connecting-ip'] || req.ip;
	},
	onLimitReached: function (req, res, options) {
		console.log(`****************************************************rate limit reached for ip: ${req.headers['cf-connecting-ip'] || req.ip}`);
	}
});

app.use(limiter);


app.use(
	morgan('dev', {
		skip: () => app.get('env') === 'test'
	})
);

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));

supplierRoutes.setRoutes(app);

app.use(createLogs);

app.use(handleNotFound);
app.use(handleErrors);

module.exports = app;

function handleErrors (err, req, res, next) {
	let ip = req.connection.remoteAddress;
	let statusCode = err.status || InternalServerError.code;
	let statusMessage = err.statusCode || InternalServerError.name;
	winston.error({
		time: moment().format('YYYY-MM-DD HH:mm:ss A'),
		address: ip,
		path: req.path,
		params: req.params,
		query: req.query,
		statusCode: statusCode,
		statusMessage: statusMessage,
		errorMessage: err.message,
		SequelizeForeignKeyConstraintError: err.SequelizeForeignKeyConstraintError
	});

	if (err.transaction)
		err.transaction.rollback();

	res.status(statusCode).json(formatResponse(null, statusCode, statusMessage, err.message));
	next();
}

function handleNotFound (req, res, next) {
	let ip = req.connection.remoteAddress;
	let statusCode = NotFound.code;
	let statusMessage = NotFound.name;
	winston.error({
		time: moment().format('YYYY-MM-DD HH:mm:ss A'),
		address: ip,
		path: req.path,
		params: req.params,
		query: req.query,
		statusCode: statusCode,
		errorMessage: statusMessage
	});
	res.status(statusCode).json(formatResponse(null, statusCode, statusMessage, statusMessage));
	next();
}

function createLogs (req, res, next) {
	let ip = req.connection.remoteAddress;
	winston.info({
		address: ip,
		path: req.path,
		params: req.params,
		query: req.query
	});
	next();
}