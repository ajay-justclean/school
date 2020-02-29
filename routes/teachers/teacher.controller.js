const service = require('./teacher.service');
const validation = require('./teacher.validation');
const GeneralException = require('../../exceptions/general.exception');
const HttpResponses = require('./../../constants/http-responses.constants');
const defaultPageLimit = require('../../constants/pagination.constants').defaultPageLimit;
const formatResponse = require('../../helpers/response.helper').formatResponse;
const moment = require('moment');
const Op = require('sequelize').Op;

async function getPartnersList(req, res, next) {
	const reqUser = req.user;
	const reqHeaders = req.headers;
	const reqQuery = req.query;
	const countryId = reqHeaders.country_id || reqUser.country_id;
	/* paginate */
	let offset = (reqQuery.page - 1) * defaultPageLimit;
	offset = (offset) ? parseInt(offset) : 0;
	let currentPage = reqQuery.page || 1;
	/* end paginate */

	const startDate = moment.utc().format('YYYY-MM-DD 00:00:00');
	const stopDate = moment.utc().format('YYYY-MM-DD 23:59:59');
	try {
		let response = await service.getPartnersList(countryId, startDate, stopDate, offset, defaultPageLimit, reqUser, reqQuery);
		response.rows = getFormatedPartner(response.rows);
		response.current_page = currentPage;
		response.item_count = defaultPageLimit;
		return res.status(HttpResponses.OK.code).json(formatResponse(response));

	} catch (e) {
		return next(e);
	}
}

async function addEditPartners(req, res, next) {
	const reqBody = req.body;
	const reqUser = req.user;
	const reqHeaders = req.headers;
	const countryId = reqHeaders.country_id || reqUser.country_id;
	const errReason = validation.validateAddEditPartners(reqBody);
	if (errReason) {
		return next(GeneralException.ValidationError(errReason));
	}
	try {
		let partnerResult = null;
		if (reqBody.id) {
			partnerResult = await service.getPartners(reqBody);
			if (!partnerResult) {
				return next(GeneralException.ValidationError( 'Partner ID is invalid!'));
			}
		}
		let response = [];
		if (partnerResult) {
			await service.updatePartners(partnerResult, reqBody);
		} else {
			let uniquePin= await fetchUniquePinForPartner();
			response = await service.createPartners(
				{
					mobile_no: reqBody.mobile_no,
					first_name: reqBody.partner_translations[0].first_name,
					last_name: reqBody.partner_translations[0].last_name,
					area_id: reqBody.area_id,
					governorate_id: reqBody.governorate_id,
					pin_no: uniquePin,
					country_id: countryId,
					status: 'active',
					group_id: reqHeaders.group_id,
					car_plate_no: reqBody.car_plate_no,
					address: reqBody.address,
					partner_translations: reqBody.partner_translations,
					supplier_id: reqUser.id
				});
		}
		return res.status(HttpResponses.OK.code).json(formatResponse(response));

	} catch (e) {
		return next(e);
	}
}

async function fetchUniquePinForPartner() {
	let pin = uniquePinHelper.getRandomInt(4);
	let slicedPin = pin.slice(2);
	let partnerList = await service.fetchAllPartners({pin_no: {[Op.like]: `${slicedPin}%`}})
	let partnerPins = partnerList.map(partner=> partner.pin_no);
	let isPinInList = uniquePinHelper.isPinAlreadyInList(pin, partnerPins);
	if (isPinInList) {
		pin = fetchUniquePinForPartner();
	}

	return pin;
}

async function deletePartner(req, res, next) {
	const reqBody = req.body;
	const reqUser = req.user;
	const reqHeaders = req.headers;
	const partnerId = req.params.partner_id;
	const countryId = reqHeaders.country_id || reqUser.country_id;
	try {
		if (!partnerId) {
			return next(GeneralException.ValidationError('partner required..'));
		}
		let partnerResult = null;
		partnerResult = await service.getPartner({
			id:partnerId,
			supplier_id:reqUser.id
		});

		if (!partnerResult) {
			return next(GeneralException.ValidationError( 'Partner ID is invalid!'));
		}
		if (partnerResult.is_tracking_enabled) {
			return next(GeneralException.ValidationError( 'This partner is busy with other task!'));
		}

		let response = await service.deletePartner(partnerId);
		await service.deletePartnerDevice(partnerId);
		if(response){
			// unassign order for partner
			let assignedOrders = await service.findAssignedOrders(partnerId);
			assignedOrders = await Promise.all(assignedOrders.map(async (order) => {
				await OrderAssignments.logOrderAssignments(order.order, {userSupplier: reqUser.id});
				return order.order_id;
			}));
			if(assignedOrders && assignedOrders.length) {
				await Promise.all([service.deleteOrderTracking({order_id: assignedOrders, partner_id: partnerId, is_completed: false}),
					service.unAssignOrders(assignedOrders)]);
			}
			notificationsHelper.sendSilentNotificationToPartner(-1, partnerId, '', 'Delete Partner', 'delete');
			// end===>
		}
		return res.status(HttpResponses.OK.code).json(formatResponse(response));

	} catch (e) {
		return next(e);
	}
}

async function activeInactivePartner(req, res, next) {
	try {
		const status = req.body.status;
		const partnerId = req.body.id;
		const reqUser = req.user;
		const reqHeaders = req.headers;
		const countryId = reqHeaders.country_id || reqUser.country_id;
		let params = {
			country_id:countryId,
			id:partnerId,
			status:status
		};
		const errReason = validation.validateActInactPartner(params);
		if (errReason) {
			return next(GeneralException.ValidationError(errReason));
		}
		const partnerInfo = await service.getPartner({
			id:partnerId
		});
		if(!partnerInfo) {
			return next(GeneralException.ValidationError('Partner doesn\' exist.'));
		}
		let resMessage = 'Partner is inactivated.';
		if(status === 'active') {
			partnerInfo.status = status;
			resMessage = 'Partner is activated.';
			notificationsHelper.sendSilentNotificationToPartner(-1, partnerId, '', 'Active Partner', 'active');
		}
		if(status === 'inactive' && partnerId){
			if(partnerInfo.is_tracking_enabled) {
				return next(GeneralException.ValidationError('Partner is busy with a task, please let him complete.'));
			}
			// unassign order for partner
			let assignedOrders = await service.findAssignedOrders(partnerId);
			assignedOrders = await Promise.all(assignedOrders.map(async (order) => {
				await OrderAssignments.logOrderAssignments(order.order, {userSupplier: reqUser.id});
				return order.order_id;
			}));
			if(assignedOrders && assignedOrders.length) {
				// await Promise.all([service.deleteOrderTracking({order_id: assignedOrders, partner_id: partnerId, is_completed: false}),
				// 	service.unAssignOrders(assignedOrders)]);
				await service.deleteOrderTracking({order_id: assignedOrders, partner_id: partnerId, is_completed: false});
				await service.unAssignOrders(assignedOrders, partnerId);
			}
			notificationsHelper.sendSilentNotificationToPartner(-1, partnerId, '', 'Suspend Partner', 'suspend');
			// end===>
		}
		if(status === 'inactive' && partnerId) {
			partnerInfo.is_available = false;
		}
		partnerInfo.status = params.status;
		await partnerInfo.save(partnerInfo);

		return res.status(HttpResponses.OK.code).json(formatResponse([],'','',resMessage));
	} catch (e) {
		return next(e);
	}
}

async function getPartnerTaskList(req, res, next) {
	const reqUser = req.user;
	const reqHeaders = req.headers;
	const reqQuery = req.query;
	const reqParams = req.params;
	const countryId = reqHeaders.country_id || reqUser.country_id;
	/* paginate */
	let offset = (reqQuery.page - 1) * defaultPageLimit;
	offset = (offset) ? parseInt(offset) : 0;
	let currentPage = reqQuery.page || 1;
	/* end paginate */
	let partnerId = {};
	if(reqParams.partner_id){
		partnerId = reqParams.partner_id;
		let partner = await service.getPartner({
			id:partnerId,
			supplier_id:reqUser.id
		});
		if(!partner) {
			return next(GeneralException.ValidationError('Partner doesn\' exist.'));
		}
	}

	try {
		let response = await service.getPartnerTaskList(offset, defaultPageLimit, reqUser, reqQuery, partnerId);

		response.rows = getFormatedPartnerTask(response.rows);
		response.current_page = currentPage;
		response.item_count = defaultPageLimit;
		return res.status(HttpResponses.OK.code).json(formatResponse(response));

	} catch (e) {
		return next(e);
	}
}

async function getPartnerTransactionList(req, res, next) {
    const reqUser = req.user;
    const reqHeaders = req.headers;
    const reqQuery = req.query;
    const reqParams = req.params;
    /* paginate */
    let offset = (reqQuery.page - 1) * defaultPageLimit;
    offset = (offset) ? parseInt(offset) : 0;
    let currentPage = reqQuery.page || 1;
    /* end paginate */

    try {
        let partnerId = {};
        if(reqParams.partner_id){
            partnerId = reqParams.partner_id;
            let partner = await service.getPartner({
                id:partnerId,
                supplier_id:reqUser.id
            });
            if(!partner) {
                return next(GeneralException.ValidationError('Partner doesn\' exist.'));
            }
        }

        let response = await service.getPartnerTransactionList(offset, defaultPageLimit, reqUser, reqQuery, partnerId);
        // response.rows = getFormatedPartnerTask(response.rows);
        response.current_page = currentPage;
        response.item_count = defaultPageLimit;
        return res.status(HttpResponses.OK.code).json(formatResponse(response));

    } catch (e) {
        return next(e);
    }
}

async function resetPartnerDevice(req, res, next) {
	const reqBody = req.body;
	const reqUser = req.user;
	try {
		if(!reqBody.partner_id) {
			return next(GeneralException.ValidationError('Please provide partner'));
		}
		let partner = await service.getPartner({id: reqBody.partner_id, supplier_id: reqUser.id});
		if(!partner) {
			return next(GeneralException.ValidationError('Partner doesn\'t exist.'));
		}
		await service.deletePartnerDevice(reqBody.partner_id);
		return res.status(HttpResponses.OK.code).json(formatResponse(null,null,null,'Device ID has been reset successfully.'));

	} catch (e) {
		return next(e);
	}
}


module.exports = {
	getPartnersList,
	addEditPartners,
	deletePartner,
	activeInactivePartner,
	getPartnerTaskList,
    getPartnerTransactionList,
	resetPartnerDevice
};

function getFormatedPartner(partnerRecords) {
	return partnerRecords.map(partner => {
		partner = partner.get({plain: true});
		partner.assigned_area_count = partner.partners_area.length;
		if(partner.status === 'inactive'){
			partner.status = 'Unavailable';
		}
		return partner;
	});
}

function  getFormatedPartnerTask(tasks) {

	return tasks.map(task=>{
		let time = task.order.pickup_timeslot.time;
		let newtime = moment(task.order.pickup_timeslot.time, 'HH:mm:ss').format('HH:mm A');
		let formatTime = moment(time, 'HH:mm:ss').add(60,'minutes').format('HH:mm A');
		let newdt = newtime +' - '+formatTime;
		let taskDate = moment(task.order.pickup_at).format('MMM DD, YYYY');
		let updatetime = moment(task.updated_at).format('HH:mm A');
		let partnerfname = task.partner.first_name ? task.partner.first_name : '';
		let partnerlname = task.partner.last_name ? task.partner.last_name : '';
		let type = task.tracking_type;

		let data = {};
		data.task_id=task.order.id;
		data.tracking_type=type;
		data.task_date=taskDate;
		data.timeslot= newdt;
		data.task_area = task.order.pickup_address.area.name;
		// data.task_status = task.order.statuses_user_id === 5  || task.order.statuses_user_id === 8 ? 'completed':task.order.statuses_user.name;

		data.task_status = task.is_completed ? 'completed':task.order.statuses_user.name;

		data.status_updated_at = updatetime;
		data.captain_name = partnerfname+' '+ partnerlname;
		data.captain_phone = task.partner.mobile_no;
		if(task.order.log_order_requests && task.order.log_order_requests.length){
			let logOrderRequest = task.order.log_order_requests.find(element=>element.status_from_id === 3 && element.partner_id === task.partner.id && element.status === 'pending');
			if(logOrderRequest){
				data.task_status = 'Pending Commission';
			}
		}

		return data;
	});
}