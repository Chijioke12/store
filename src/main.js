/*global Promise, alert*/
(function () {
"use strict";

var REGISTRY_URL = 'https://raw.githubusercontent.com/Chijioke12/Open-KaiStore-Registry/refs/heads/main/apps.json';

var currentView = 'list';
var cachedApps = [];
var currentAppIndex = -1;

function installFromApp(app) {
	return new Promise(function (resolve, reject) {
		if (!app) {
			reject('No app provided');
			return;
		}
		if (!navigator.mozApps) {
			// For testing in normal browsers, fallback
			var url = app.type === 'hosted' ? app.manifest_url : app.download_url;
			console.log('Would install ' + app.type + ' app from: ' + url);
			alert('Would install ' + app.type + ' app from: ' + url + '\n(mozApps API not available in this browser)');
			resolve();
			return;
		}
		
		var request;
		if (app.type === 'hosted') {
			if (!app.manifest_url) {
				reject('No manifest_url provided for hosted app');
				return;
			}
			request = navigator.mozApps.install(app.manifest_url);
		} else {
			if (!app.download_url) {
				reject('No download_url provided for packaged app');
				return;
			}
			// KaiOS installPackage needs a mini-manifest served with application/x-web-app-manifest+json.
			// GitHub does not provide this content-type.
			// We can generate this locally with a data URI!
			var miniManifest = {
				"name": app.name || "App",
				"package_path": app.download_url,
				"version": app.version || "1.0",
				"developer": {
					"name": app.author || "Unknown"
				}
			};
			var dataUri = 'data:application/x-web-app-manifest+json,' + encodeURIComponent(JSON.stringify(miniManifest));
			request = navigator.mozApps.installPackage(dataUri);
		}
		
		request.onsuccess = resolve;
		request.onerror = function () {
			reject('Installing failed: ' + this.error.name);
		};
	});
}

function showMessagesFor (promise, success) {
	promise.then(function () {
		if (success) {
			alert(success);
		}
	}, function (error) {
		alert(error);
	});
}

function renderApps(apps) {
	cachedApps = apps;
	renderAppsFiltered(apps);
}

function renderAppsFiltered(appsToRender) {
	var listContainer = document.getElementById('app-list');
	listContainer.innerHTML = '';
	
	appsToRender.forEach(function(app) {
		var index = cachedApps.indexOf(app);
		var card = document.createElement('div');
		card.className = 'app-card';
		card.tabIndex = 0;
		card.dataset.index = index;
		
		var header = document.createElement('div');
		header.className = 'app-header';
		
		var icon = document.createElement('img');
		icon.className = 'app-icon';
		icon.src = app.icon || 'icon.svg';
		icon.alt = app.name + ' icon';
		// Fallback for broken images
		icon.onerror = function() { this.src = 'icon.svg'; };
		
		var info = document.createElement('div');
		info.className = 'app-info';
		
		var title = document.createElement('h2');
		title.className = 'app-title';
		title.textContent = app.name;
		
		var author = document.createElement('p');
		author.className = 'app-author';
		author.textContent = app.author || 'Unknown Author';
		
		info.appendChild(title);
		info.appendChild(author);
		header.appendChild(icon);
		header.appendChild(info);
		
		var desc = document.createElement('p');
		desc.className = 'app-description';
		desc.textContent = app.description || 'No description available.';
		
		card.addEventListener('click', function() {
			showDetails(index);
		});
		
		card.appendChild(header);
		card.appendChild(desc);
		
		listContainer.appendChild(card);
	});
	
	// Initialize focus handling
	initSpatialNavigation();
}

function initSpatialNavigation() {
	var cards = document.querySelectorAll('.app-card');
	var softkeyCenter = document.getElementById('softkey-center');
	var searchInput = document.getElementById('search-input');
	
	if (cards.length > 0 && document.activeElement !== searchInput) {
		cards[0].focus();
	}
	
	for (var i = 0; i < cards.length; i++) {
		(function(card) {
			card.addEventListener('focus', function() {
				if (currentView === 'list') {
					softkeyCenter.textContent = 'VIEW';
				}
			});
			card.addEventListener('blur', function() {
				if (currentView === 'list') {
					softkeyCenter.textContent = '';
				}
			});
		})(cards[i]);
	}
}

function showDetails(index) {
	currentAppIndex = index;
	currentView = 'details';
	var app = cachedApps[index];
	
	document.getElementById('app-content').classList.add('hidden');
	var detailsView = document.getElementById('view-details');
	detailsView.classList.remove('hidden');
	detailsView.scrollTop = 0;
	
	detailsView.innerHTML = '';
	
	var header = document.createElement('div');
	header.className = 'app-header';
	
	var icon = document.createElement('img');
	icon.className = 'app-icon';
	icon.src = app.icon || 'icon.svg';
	icon.onerror = function() { this.src = 'icon.svg'; };
	
	var info = document.createElement('div');
	info.className = 'app-info';
	
	var title = document.createElement('h2');
	title.className = 'app-title';
	title.textContent = app.name;
	
	var author = document.createElement('p');
	author.className = 'app-author';
	author.textContent = app.author || 'Unknown Author';
	
	info.appendChild(title);
	info.appendChild(author);
	header.appendChild(icon);
	header.appendChild(info);
	
	var desc = document.createElement('div');
	desc.className = 'details-description';
	desc.textContent = app.description || 'No description available.';
	
	var typeInfo = document.createElement('p');
	typeInfo.className = 'app-author';
	typeInfo.style.marginTop = '10px';
	typeInfo.style.fontWeight = 'bold';
	typeInfo.textContent = 'Type: ' + (app.type === 'hosted' ? 'Hosted' : 'Packaged');
	
	detailsView.appendChild(header);
	detailsView.appendChild(typeInfo);
	detailsView.appendChild(desc);
	
	document.getElementById('softkey-center').textContent = 'INSTALL';
	document.getElementById('softkey-right').textContent = 'BACK';
	document.getElementById('softkey-left').textContent = '';
}

function hideDetails() {
	currentView = 'list';
	document.getElementById('view-details').classList.add('hidden');
	document.getElementById('app-content').classList.remove('hidden');
	
	document.getElementById('softkey-right').textContent = '';
	document.getElementById('softkey-left').textContent = 'Search';
	var cards = document.querySelectorAll('.app-card');
	if (currentAppIndex !== -1 && cards[currentAppIndex]) {
		cards[currentAppIndex].focus();
	} else {
		document.getElementById('softkey-center').textContent = '';
	}
}

document.addEventListener('keydown', function(e) {
	if (currentView === 'details') {
		if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'SoftRight') {
			e.preventDefault();
			hideDetails();
			return;
		}
		if (e.key === 'Enter') {
			var app = cachedApps[currentAppIndex];
			showMessagesFor(installFromApp(app), 'Installed successfully!');
			return;
		}
		// If other keys, maybe we can scroll?
		var detailsView = document.getElementById('view-details');
		if (e.key === 'ArrowDown') {
			detailsView.scrollTop += 30;
			e.preventDefault();
		} else if (e.key === 'ArrowUp') {
			detailsView.scrollTop -= 30;
			e.preventDefault();
		}
		return;
	}

	var active = document.activeElement;
	var isCard = active && active.classList.contains('app-card');
	var isSearch = active && active.id === 'search-input';
	var cards = Array.from(document.querySelectorAll('.app-card'));
	var currentIndex = cards.indexOf(active);
	
	switch(e.key) {
		case 'ArrowDown':
			if (isSearch && cards.length > 0) {
				cards[0].focus();
				e.preventDefault();
			} else if (isCard && currentIndex < cards.length - 1) {
				cards[currentIndex + 1].focus();
				cards[currentIndex + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
			} else if (!isCard && !isSearch && cards.length > 0) {
				cards[0].focus();
			}
			e.preventDefault();
			break;
		case 'ArrowUp':
			if (isCard) {
				if (currentIndex > 0) {
					cards[currentIndex - 1].focus();
					cards[currentIndex - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
				} else if (currentIndex === 0) {
					var searchInput = document.getElementById('search-input');
					if (searchInput) {
						searchInput.focus();
					}
				}
			}
			e.preventDefault();
			break;
		case 'Enter':
			if (isCard) {
				active.click();
			}
			break;
		case 'SoftLeft':
			var searchInput = document.getElementById('search-input');
			if (searchInput && document.activeElement !== searchInput) {
				searchInput.focus();
			}
			e.preventDefault();
			break;
	}
});

function loadRegistry() {
	var loaddiv = document.getElementById('loading');
	var errordiv = document.getElementById('error');
	
	fetch(REGISTRY_URL)
		.then(function(res) {
			if (!res.ok) throw new Error('HTTP error ' + res.status);
			return res.json();
		})
		.then(function(data) {
			loaddiv.classList.add('hidden');
			if (data && data.apps && Array.isArray(data.apps)) {
				renderApps(data.apps);
			} else {
				throw new Error('Invalid registry format');
			}
		})
		.catch(function(err) {
			loaddiv.classList.add('hidden');
			errordiv.classList.remove('hidden');
			errordiv.textContent = 'Failed to load apps: ' + err.message;
		});
}

// Init
function initApp() {
	document.getElementById('softkey-left').textContent = 'Search';
	
	var searchInput = document.getElementById('search-input');
	if (searchInput) {
		searchInput.addEventListener('input', function() {
			var query = this.value.toLowerCase();
			var filteredApps = cachedApps.filter(function(app) {
				return app.name.toLowerCase().indexOf(query) !== -1 || 
					   (app.author && app.author.toLowerCase().indexOf(query) !== -1) ||
					   (app.description && app.description.toLowerCase().indexOf(query) !== -1);
			});
			renderAppsFiltered(filteredApps);
		});

		searchInput.addEventListener('focus', function() {
			if (currentView === 'list') {
				document.getElementById('softkey-center').textContent = 'SEARCH';
			}
		});
		searchInput.addEventListener('blur', function() {
			if (currentView === 'list' && document.activeElement && document.activeElement.tagName !== 'INPUT') {
				document.getElementById('softkey-center').textContent = '';
			}
		});
	}
	loadRegistry();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initApp);
} else {
	initApp();
}

})();
