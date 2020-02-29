const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const dotenv = require('dotenv');
dotenv.config();
const env = process.env.APP_ENVIRONMENT || 'development';
const config = require('../config/db.config.js')[env];
const db = {};

global.__config = config;

let sequelize = new Sequelize(config.database, config.username, config.password, config);

fs
	.readdirSync(__dirname)
	.filter(file => {
		return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
	})
	.forEach(file => {
		const model = sequelize['import'](path.join(__dirname, file));
		db[model.name] = model;
	});

Object.keys(db).forEach(modelName => {
	if (db[modelName].associate) {
		db[modelName].associate(db);
	}
});

const attemptConnection = () => {
	sequelize
		.authenticate()
		.then(() => {
			// eslint-disable-next-line no-console
			console.log('Database Connection has been established successfully.');
		})
		.catch(err => {
			// eslint-disable-next-line no-console
			console.error('Unable to connect to the database:', err);

			sequelize.connectionManager.initPools();
			attemptConnection();
		});
};
attemptConnection();

setInterval(attemptConnection, 100000);


db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;