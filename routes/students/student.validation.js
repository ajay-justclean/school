module.exports = {
	validateAddEditPartners: (reqBody) => {
		let message = null;

		if (reqBody.id && (parseInt(reqBody.id) <= 0 || isNaN(reqBody.id))) {
			message = 'Partner ID is invalid!';
		}
		else if (!reqBody.partner_translations[0].first_name) {
			message = 'First name is required!';
		}
		else if (!reqBody.partner_translations[0].last_name) {
			message = 'Last name is required!';
		}
		else if (!reqBody.car_plate_no) {
			message = 'Car plate number is required!';
		}
		else if (!reqBody.mobile_no) {
			message = 'Mobile number is required!';
		}
		else if (!reqBody.mobile_no || parseInt(reqBody.mobile_no) <= 0 || isNaN(reqBody.mobile_no)) {
			message = 'mobile no should be valid!';
		}
		else if (!reqBody.address) {
			message = 'Address is required!';
		}
		// else if (!reqBody.area_id || parseInt(reqBody.area_id) <= 0 || isNaN(reqBody.area_id)) {
		// 	message = 'Area is Required!';
		// }
		else if (!reqBody.governorate_id || parseInt(reqBody.governorate_id) <= 0 || isNaN(reqBody.governorate_id)) {
			message = 'Governorate is Required!';
		}
		else if (!reqBody.partner_translations || !reqBody.partner_translations.length) {
			message = 'Partner translations is required!';
		}
		else if (reqBody.partner_translations && reqBody.partner_translations.length > 0) {
			for (let i = 0; reqBody.partner_translations.length > i; i++) {
				if (!reqBody.partner_translations[i].first_name) {
					message = 'First name required!';
					break;
				}
				if (!reqBody.partner_translations[i].last_name) {
					message = 'Last name required!';
					break;
				}
				if (!reqBody.partner_translations[i].language_id || isNaN(reqBody.partner_translations[i].language_id)) {
					message = 'Language id required!';
					break;
				}
			}
		}

		return message;
	},

	validateActInactPartner: (params) => {
		let message = null;
		if(!params.status) {
			message = 'Status required';
		}
		if(!params.id) {
			message = 'Partner id required';
		}
		// if(params.status && params.status !== 'active' || params.status !== 'inactive') {
		// 	message = 'Status should be active or inactive only';
		// }
		return message;
	}
};
