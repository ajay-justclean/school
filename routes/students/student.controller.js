const service = require('./student.service');
const validation = require('./student.validation');


async function fetch(req, res, next) {
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

async function create(req, res, next) {
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

async function deleteStudent(req, res, next) {
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

async function update(req, res, next) {
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
	create,fetch,update,deleteStudent
};
