importScripts('js/idb.js');

cacheName = 'static-v1'
imagesCache = 'images-cache'
var allCaches = [cacheName, imagesCache]



const dbPromise = idb.openDB('restaurants_db', 2, {
  upgrade(db, oldVersion, newVersion, transaction) {
	  	console.log('upgrade db');
	    var keyValStore = db.createObjectStore('restaurants',{
	    	keyPath: 'id'
	    });
  },
  blocked() {
	console.log('This version is blocked by another version');
  },
  blocking() {
    console.log('This version is blocking a newer version from being deployed.');
  }
});


self.addEventListener('install', function(event){
	console.log('installing');
	// open a cache and save all files
	event.waitUntil(
		caches.open(cacheName).then(function(cache){
			return cache.addAll([
					'https://unpkg.com/leaflet@1.3.1/dist/leaflet.css',
					'https://unpkg.com/leaflet@1.3.1/dist/leaflet.js',
					'/',
					'/restaurant.html',
					'css/styles.css',
					'js/dbhelper.js',
					'js/main.js',
					'js/restaurant_info.js',
					'js/idb.js',
					'/manifest.json',
					'/icon.png'
					// 'data/restaurants.json',
				]
			);
		})
	);
});


self.addEventListener('activate', function(event) {
	console.log('activating');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return !allCaches.includes(cacheName);
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});



self.addEventListener('fetch', function(event){
	var requestUrl = new URL(event.request.url);
	
	if(requestUrl.pathname == '/restaurants'){
		event.respondWith(serveJSONData(event.request));
	}
	else  if (requestUrl.pathname.startsWith('/img/')) {
      event.respondWith(servePhoto(event.request));
    } else{
		event.respondWith(serveWebsite(event.request));	
	}
	
	return;
});


function serveWebsite(request){
	return caches.match(request).then(function(response){
		return response || fetch(request);
	})
}

	
/*
	fetch and always store in db.
	if fetch fails, then return 

*/
function serveJSONData(request){
	console.log('serving json data');
	return fetch(request).then(function(response){
		if(!response.ok){
			console.log('response not ok, constructing offline response');
			return response;
		}
		else{
			fetchAndStoreRestaurants(response.clone());
			return response;			
		}
	}).catch(function(error){
		console.warn('fetch failed:', error);
	

		return dbPromise.then(function(db){	
			var tx = db.transaction('restaurants');
			var store = tx.objectStore('restaurants');

			return store.getAll().then(function(data){
				return new Response(JSON.stringify(data), headers());
			});
		});		


	});
}	


function servePhoto(request) {
  var storageUrl = request.url.replace(/-\d+px\.jpg$/, '');

  return caches.open('images-cache').then(function(cache) {
    return cache.match(storageUrl).then(function(response) {
      if (response) return response;

      return fetch(request).then(function(networkResponse) {
        cache.put(storageUrl, networkResponse.clone());
        return networkResponse;
      });
    });
  });
}


function fetchAndStoreRestaurants(response){
	response.json().then(function(restaurants){
		console.log(restaurants);

		dbPromise.then(function(db){
			var tx = db.transaction('restaurants', 'readwrite');
			var store = tx.objectStore('restaurants');			

			restaurants.forEach(function(restaurant){
				store.put(restaurant);
			});
		});


		return;
	}).catch(function(error){
		console.warn('error @ fetchAndStoreRestaurants due to:', error);
	});
}



function headers(data){
	var init = {
	    status: 200,
	    statusText: 'OK',
	    headers: {}
	};

	init.headers['Content-Type'] = 'text/json';


	return init;
}

function getDataFromDB(){
	return dbPromise.then(function(db){	
		var tx = db.transaction('restaurants');
		var store = tx.objectStore('restaurants');

		return store.getAll().then(function(data){
			return data;
		});		
	})
}
