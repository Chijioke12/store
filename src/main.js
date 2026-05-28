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
			// Resolve manifest URL to use raw.githack.com to ensure correct MIME type is delivered
			var manifestUrl = app.manifest_url;
			if (manifestUrl.indexOf('raw.githubusercontent.com') !== -1) {
				manifestUrl = manifestUrl.replace('raw.githubusercontent.com', 'raw.githack.com');
			} else if (manifestUrl.indexOf('github.com') !== -1 && manifestUrl.indexOf('/raw/') !== -1) {
				manifestUrl = manifestUrl.replace('github.com', 'raw.githack.com').replace('/raw/', '/');
			}
			
			console.log('Installing hosted app via:', manifestUrl);
			request = navigator.mozApps.install(manifestUrl);
			
			request.onsuccess = resolve;
			request.onerror = function () {
				reject('Installing failed: ' + (this.error ? this.error.name : 'Unknown error'));
			};
		} else {
			if (!app.download_url) {
				reject('No download_url provided for packaged app');
				return;
			}

			console.log('Fetching binary OmniSD blob from:', app.download_url);
			
			// 1. Manually fetch the raw zip package binary using systemXHR to bypass CORS restrictions
			var downloadBlob = function(url) {
				return new Promise(function(resolveBlob, rejectBlob) {
					var xhr;
					try {
						// On device, create privileged systemXHR to bypass CORS
						xhr = new XMLHttpRequest({ mozSystem: true });
					} catch (e) {
						// Fallback to standard request for standard browsers
						xhr = new XMLHttpRequest();
					}
					xhr.open('GET', url, true);
					xhr.responseType = 'blob';
					xhr.onload = function() {
						if (xhr.status >= 200 && xhr.status < 300) {
							resolveBlob(xhr.response);
						} else {
							rejectBlob(new Error('HTTP Error ' + xhr.status + ': ' + (xhr.statusText || 'Unknown')));
						}
					};
					xhr.onerror = function() {
						rejectBlob(new Error('Network request failed'));
					};
					xhr.send();
				});
			};

			downloadBlob(app.download_url)
				.then(function(blob) {
					// 2. Feed the raw package bundle into the native device storage manager
					if (navigator.mozApps.mgmt && typeof navigator.mozApps.mgmt.import === 'function') {
						var request = navigator.mozApps.mgmt.import(blob);
						
						request.onsuccess = function() {
							resolve();
						};
						request.onerror = function() {
							reject('Import failed: ' + (this.error ? this.error.name : 'Unknown system error'));
						};
					} else {
						reject('Privileged Management API missing. Is this device jailbroken?');
					}
				})
				.catch(function(err) {
					reject('Download failed: ' + err.message);
				});
		}
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
	var searchInput = document.getElementById('search-input');
	
	if (cards.length > 0 && document.activeElement !== searchInput) {
		cards[0].focus();
	}
	
	for (var i = 0; i < cards.length; i++) {
		(function(card) {
			card.addEventListener('focus', function() {
				updateListSoftkeys();
			});
			card.addEventListener('blur', function() {
				updateListSoftkeys();
			});
		})(cards[i]);
	}
	updateListSoftkeys();
}

function showDetails(index) {
	currentAppIndex = index;
	currentView = 'details';
	var app = cachedApps[index];
	
	document.getElementById('app-content').classList.add('hidden');
	document.getElementById('view-settings').classList.add('hidden');
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
	
	document.getElementById('softkey-left').textContent = '';
	document.getElementById('softkey-center').textContent = 'INSTALL';
	document.getElementById('softkey-right').textContent = 'BACK';
}

function hideDetails() {
	currentView = 'list';
	document.getElementById('view-details').classList.add('hidden');
	document.getElementById('app-content').classList.remove('hidden');
	
	updateListSoftkeys();
	var cards = document.querySelectorAll('.app-card');
	if (currentAppIndex !== -1 && cards[currentAppIndex]) {
		cards[currentAppIndex].focus();
	}
}

function showSettings() {
	currentView = 'settings';
	document.getElementById('app-content').classList.add('hidden');
	document.getElementById('view-details').classList.add('hidden');
	
	var viewSettings = document.getElementById('view-settings');
	viewSettings.classList.remove('hidden');
	
	var proxyInput = document.getElementById('proxy-input');
	proxyInput.value = localStorage.getItem('manifest_proxy_url') || '';
	proxyInput.focus();
	
	document.getElementById('softkey-left').textContent = 'SAVE';
	document.getElementById('softkey-center').textContent = '';
	document.getElementById('softkey-right').textContent = 'BACK';
}

function hideSettings(save) {
	if (save) {
		var val = document.getElementById('proxy-input').value.trim();
		if (val && !val.startsWith('http://') && !val.startsWith('https://')) {
			alert('Proxy URL must start with http:// or https://');
			return;
		}
		localStorage.setItem('manifest_proxy_url', val);
		alert('Settings saved successfully!');
	}
	
	currentView = 'list';
	document.getElementById('view-settings').classList.add('hidden');
	document.getElementById('app-content').classList.remove('hidden');
	
	updateListSoftkeys();
	var cards = document.querySelectorAll('.app-card');
	if (cards.length > 0) {
		cards[0].focus();
	}
}

function updateListSoftkeys() {
	if (currentView !== 'list') return;
	
	var active = document.activeElement;
	var isSearch = active && active.id === 'search-input';
	
	document.getElementById('softkey-left').textContent = 'SETTINGS';
	
	if (isSearch) {
		document.getElementById('softkey-center').textContent = 'SEARCH';
		document.getElementById('softkey-right').textContent = '';
	} else {
		document.getElementById('softkey-center').textContent = 'VIEW';
		document.getElementById('softkey-right').textContent = 'SEARCH';
	}
}

document.addEventListener('keydown', function(e) {
	// 1. Settings View Key Event Handling
	if (currentView === 'settings') {
		if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'SoftRight' || e.key === 'F2') {
			e.preventDefault();
			hideSettings(false);
			return;
		}
		if (e.key === 'SoftLeft' || e.key === 'F1') {
			e.preventDefault();
			hideSettings(true);
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			hideSettings(true);
			return;
		}
		return;
	}

	// 2. Details View Key Event Handling
	if (currentView === 'details') {
		if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'SoftRight' || e.key === 'F2') {
			e.preventDefault();
			hideDetails();
			return;
		}
		if (e.key === 'Enter') {
			var app = cachedApps[currentAppIndex];
			showMessagesFor(installFromApp(app), 'Installed successfully!');
			return;
		}
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

	// 3. Main List View Key Event Handling
	var active = document.activeElement;
	var isCard = active && active.classList.contains('app-card');
	var isSearch = active && active.id === 'search-input';
	var cards = Array.from(document.querySelectorAll('.app-card'));
	var currentIndex = cards.indexOf(active);
	
	// Softkey triggers
	if (e.key === 'SoftLeft' || e.key === 'F1') {
		e.preventDefault();
		showSettings();
		return;
	}
	
	if (e.key === 'SoftRight' || e.key === 'F2') {
		e.preventDefault();
		var searchInput = document.getElementById('search-input');
		if (searchInput) {
			searchInput.focus();
		}
		return;
	}
	
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
					var searchInputStr = document.getElementById('search-input');
					if (searchInputStr) {
						searchInputStr.focus();
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

function initApp() {
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
			updateListSoftkeys();
		});
		searchInput.addEventListener('blur', function() {
			updateListSoftkeys();
		});
	}
	
	// Initial softkey render
	updateListSoftkeys();
	
	loadRegistry();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initApp);
} else {
	initApp();
}

})();
