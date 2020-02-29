const express = require('express');
const routes = express.Router();
const studentController = require('./student.controller');
const passport = require('passport');


routes.get('/student', passport.authenticate('jwt', {session: false}), studentController.fetch);
routes.post('/student', passport.authenticate('jwt', {session: false}), studentController.create);
routes.patch('/:partner_id', passport.authenticate('jwt', {session: false}), studentController.update);
routes.delete('/:partner_id', passport.authenticate('jwt', {session: false}), studentController.deleteStudent);

module.exports = routes;
