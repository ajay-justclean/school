let cache = require('memory-cache');
let memCache = new cache.Cache();
let cacheMiddleware = (duration) => {
	return (req, res, next) => {
		let url = req.originalUrl || req.url;
		let key =  `__express__${req.user.uid}__${req.headers.country_id}__${url}`;
		let cacheContent = memCache.get(key);
		if(cacheContent){
			res.json( cacheContent );
			return;
		}
		res.sendResponse = res.json;
		res.json = (body) => {
			memCache.put(key,body,duration*1000);
			res.sendResponse(body);
		};
		next();

	};
};

let clearCache = () => {
	return (req, res, next) => {
		let url = req.originalUrl || req.url;
		let key = `__express__${req.user.uid}__${req.headers.country_id}__${url}`;
		memCache.del(key);
		next();
	};
};

const saveToCache = (key, data, duration) => {
	memCache.put(key,data,duration*1000);
	return data;
};


const fetchFromCache = (key) => {
	return memCache.get(key);
};
module.exports = {
	cacheMiddleware,
	saveToCache,
	fetchFromCache,
	clearCache
};
