/*global Promise, alert*/
(function () {
"use strict";

var REGISTRY_URL = 'https://raw.githubusercontent.com/Chijioke12/Open-KaiStore-Registry/refs/heads/main/apps.json';

var currentView = 'list';
var cachedApps = [];
var currentAppIndex = -1;

var categories = ["All", "Social", "Games", "Utilities", "News", "Lifestyle", "Entertainment", "Health", "Sports", "Books", "Education", "Shopping"];
var currentCategory = "All";

var currentAppState = 'INSTALL';
var currentLocalApp = null;

var activeBackup = null; // Global memory cache for the most recently probed data

function showCustomConfirm(title, message) {
	return new Promise(function(resolve) {
		var dialog = document.getElementById('custom-dialog');
		var titleEl = document.getElementById('custom-dialog-title');
		var msgEl = document.getElementById('custom-dialog-msg');
		
		titleEl.textContent = title;
		msgEl.textContent = message;
		
		dialog.classList.remove('hidden');
		
		var prevLeft = document.getElementById('softkey-left').textContent;
		var prevCenter = document.getElementById('softkey-center').textContent;
		var prevRight = document.getElementById('softkey-right').textContent;
		var prevView = currentView;
		
		currentView = 'dialog';
		
		document.getElementById('softkey-left').textContent = 'YES';
		document.getElementById('softkey-center').textContent = '';
		document.getElementById('softkey-right').textContent = 'CANCEL';
		
		function handleKey(e) {
			if (currentView !== 'dialog') return;
			
			if (e.key === 'SoftLeft' || e.key === 'F1' || e.key === 'ArrowLeft') {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cleanup(true);
			} else if (e.key === 'SoftRight' || e.key === 'F2' || e.key === 'Backspace' || e.key === 'Escape' || e.key === 'ArrowRight') {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cleanup(false);
			}
		}
		
		function cleanup(result) {
			window.removeEventListener('keydown', handleKey, true);
			dialog.classList.add('hidden');
			currentView = prevView;
			document.getElementById('softkey-left').textContent = prevLeft;
			document.getElementById('softkey-center').textContent = prevCenter;
			document.getElementById('softkey-right').textContent = prevRight;
			
			if (currentView === 'list') {
				updateListSoftkeys();
			} else if (currentView === 'details') {
				if (currentAppIndex !== -1 && cachedApps[currentAppIndex]) {
					updateDetailViewUI(cachedApps[currentAppIndex], currentAppState, currentLocalApp);
				}
			}
			
			resolve(result);
		}
		
		window.addEventListener('keydown', handleKey, true);
	});
}

function showCustomAlert(title, message) {
	return new Promise(function(resolve) {
		var dialog = document.getElementById('custom-dialog');
		var titleEl = document.getElementById('custom-dialog-title');
		var msgEl = document.getElementById('custom-dialog-msg');
		
		titleEl.textContent = title;
		msgEl.textContent = message;
		
		dialog.classList.remove('hidden');
		
		var prevLeft = document.getElementById('softkey-left').textContent;
		var prevCenter = document.getElementById('softkey-center').textContent;
		var prevRight = document.getElementById('softkey-right').textContent;
		var prevView = currentView;
		
		currentView = 'dialog';
		
		document.getElementById('softkey-left').textContent = '';
		document.getElementById('softkey-center').textContent = 'OK';
		document.getElementById('softkey-right').textContent = '';
		
		function handleKey(e) {
			if (currentView !== 'dialog') return;
			
			if (e.key === 'Enter' || e.key === 'SoftLeft' || e.key === 'F1' || e.key === 'SoftRight' || e.key === 'F2' || e.key === 'Backspace' || e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
				cleanup();
			}
		}
		
		function cleanup() {
			window.removeEventListener('keydown', handleKey, true);
			dialog.classList.add('hidden');
			currentView = prevView;
			document.getElementById('softkey-left').textContent = prevLeft;
			document.getElementById('softkey-center').textContent = prevCenter;
			document.getElementById('softkey-right').textContent = prevRight;
			
			if (currentView === 'list') {
				updateListSoftkeys();
			} else if (currentView === 'details') {
				if (currentAppIndex !== -1 && cachedApps[currentAppIndex]) {
					updateDetailViewUI(cachedApps[currentAppIndex], currentAppState, currentLocalApp);
				}
			}
			
			resolve();
		}
		
		window.addEventListener('keydown', handleKey, true);
	});
}

function alert(msg) {
	showCustomAlert('Notification', msg);
}

function backupIndexedDB(appId, dbName, storeName) {
	return new Promise(function(resolve) {
		if (!appId || !dbName || !storeName || !window.indexedDB) {
			resolve(null);
			return;
		}
		// Some system environments use different prefixes, but we try the standard B2G internal one
		var prefixes = ["app__" + appId + "_", appId + "_"];
		var tryNextPrefix = function(index) {
			if (index >= prefixes.length) {
				resolve(null);
				return;
			}
			var fullDbName = prefixes[index] + dbName;
			var dbRequest = window.indexedDB.open(fullDbName);
			dbRequest.onsuccess = function(event) {
				var db = event.target.result;
				try {
					var transaction = db.transaction(storeName, "readonly");
					var objectStore = transaction.objectStore(storeName);
					var getAllRequest = objectStore.getAll();
					getAllRequest.onsuccess = function() { 
						if (getAllRequest.result && getAllRequest.result.length > 0) {
							resolve({ db: fullDbName, data: getAllRequest.result });
						} else {
							db.close();
							tryNextPrefix(index + 1);
						}
					};
					getAllRequest.onerror = function() { db.close(); tryNextPrefix(index + 1); };
				} catch(e) { db.close(); tryNextPrefix(index + 1); }
			};
			dbRequest.onerror = function() { tryNextPrefix(index + 1); };
		};
		tryNextPrefix(0);
	});
}

function restoreIndexedDB(dbName, storeName, backupData) {
	return new Promise(function(resolve) {
		if (!dbName || !storeName || !backupData || backupData.length === 0 || !window.indexedDB) {
			resolve();
			return;
		}
		var dbRequest = window.indexedDB.open(dbName);
		dbRequest.onsuccess = function(event) {
			var db = event.target.result;
			try {
				var transaction = db.transaction(storeName, "readwrite");
				var objectStore = transaction.objectStore(storeName);
				backupData.forEach(function(item) { objectStore.put(item); });
				transaction.oncomplete = function() { db.close(); resolve(); };
			} catch(e) { db.close(); resolve(); }
		};
		dbRequest.onerror = function() { resolve(); };
	});
}

function backupAppPersistence(app) {
	var fallbacks = [
		{ db: "localforage", store: "keyvaluepairs" },
		{ db: "datas", store: "datas" },
		{ db: "app", store: "settings" },
		{ db: "app_data", store: "items" },
		{ db: "storage", store: "data" },
		{ db: "cache", store: "values" },
		{ db: "db", store: "records" },
		{ db: app.id, store: "keyvaluepairs" },
		{ db: app.id, store: "datas" },
		{ db: app.id, store: "settings" }
	];
	if (app.db_name && app.store_name) {
		fallbacks.unshift({ db: app.db_name, store: app.store_name });
	}

	var results = [];
	var sequence = Promise.resolve();
	fallbacks.forEach(function(target) {
		sequence = sequence.then(function() {
			return backupIndexedDB(app.id, target.db, target.store).then(function(res) {
				if (res && res.data && res.data.length > 0) {
					results.push({ db: res.db, store: target.store, data: res.data });
				}
			});
		});
	});
	return sequence.then(function() { 
		activeBackup = results; // Save to global memory
		return results; 
	});
}

function showDataManager(app) {
	return new Promise(function(resolve) {
		var prevView = currentView;
		currentView = 'data-manager';
		
		var detailsView = document.getElementById('view-details');
		detailsView.classList.add('hidden');
		
		var managerContainer = document.createElement('div');
		managerContainer.id = 'data-manager-view';
		managerContainer.className = 'container';
		managerContainer.style.background = '#000';
		managerContainer.style.zIndex = '200';
		
		var header = document.createElement('div');
		header.className = 'app-header';
		header.style.padding = '10px';
		header.style.background = '#3498db';
		header.style.color = '#fff';
		header.textContent = 'Data Persistence Probe';
		
		var content = document.createElement('div');
		content.style.padding = '10px';
		content.style.fontSize = '12px';
		content.style.color = '#ccc';
		
		var log = document.createElement('div');
		log.id = 'probe-log';
		log.style.marginTop = '10px';
		log.style.border = '1px solid #333';
		log.style.background = '#111';
		log.style.padding = '5px';
		log.style.maxHeight = '150px';
		log.style.overflowY = 'auto';
		log.innerHTML = 'Ready to probe environment for <b>' + app.id + '</b> patterns...';

		content.appendChild(log);
		
		var btnRow = document.createElement('div');
		btnRow.style.marginTop = '10px';
		
		var probeBtn = document.createElement('button');
		probeBtn.textContent = 'SCAN & SAVE TO MEMORY';
		probeBtn.style.width = '100%';
		probeBtn.style.background = '#27ae60';
		probeBtn.style.color = '#fff';
		probeBtn.style.padding = '10px';
		probeBtn.style.border = 'none';
		probeBtn.style.marginBottom = '5px';
		
		probeBtn.onclick = function() {
			log.innerHTML = 'Scanning local IndexedDB layers...';
			backupAppPersistence(app).then(function(results) {
				if (results.length > 0) {
					var list = '<b>Found ' + results.length + ' database stores!</b><br/>';
					results.forEach(function(r) {
						list += '- ' + r.db + ' (' + r.data.length + ' rows)<br/>';
					});
					log.innerHTML = list + '<br/><span style="color:#2ecc71">DATA CACHED IN MEMORY. READY FOR UPDATE.</span>';
				} else {
					log.innerHTML = '<span style="color:#e74c3c">No data found in standard locations.</span><br/>Tip: Running in Developer Mode is often required to probe other apps.';
				}
			});
		};

		btnRow.appendChild(probeBtn);
		
		managerContainer.appendChild(header);
		managerContainer.appendChild(content);
		managerContainer.appendChild(btnRow);
		document.body.appendChild(managerContainer);
		
		var prevLeft = document.getElementById('softkey-left').textContent;
		var prevCenter = document.getElementById('softkey-center').textContent;
		var prevRight = document.getElementById('softkey-right').textContent;
		
		document.getElementById('softkey-left').textContent = '';
		document.getElementById('softkey-center').textContent = 'PROBE';
		document.getElementById('softkey-right').textContent = 'CLOSE';
		
		function handleKey(e) {
			if (currentView !== 'data-manager') return;
			if (e.key === 'SoftRight' || e.key === 'F2' || e.key === 'Backspace') {
				e.preventDefault();
				cleanup();
			} else if (e.key === 'Enter') {
				e.preventDefault();
				probeBtn.click();
			}
		}
		
		function cleanup() {
			window.removeEventListener('keydown', handleKey, true);
			managerContainer.remove();
			currentView = prevView;
			detailsView.classList.remove('hidden');
			document.getElementById('softkey-left').textContent = prevLeft;
			document.getElementById('softkey-center').textContent = prevCenter;
			document.getElementById('softkey-right').textContent = prevRight;
			resolve();
		}
		
		window.addEventListener('keydown', handleKey, true);
	});
}

function restoreAppPersistence(backups) {
	var sequence = Promise.resolve();
	backups.forEach(function(b) {
		sequence = sequence.then(function() {
			return restoreIndexedDB(b.db, b.store, b.data);
		});
	});
	return sequence;
}

function uninstallSilently(app) {
	return new Promise(function(resolve) {
		if (!navigator.mozApps || !navigator.mozApps.mgmt) {
			resolve();
			return;
		}
		
		var request = navigator.mozApps.mgmt.getAll();
		request.onsuccess = function() {
			var installedApps = this.result || [];
			var appToUninstall = null;
			
			for (var i = 0; i < installedApps.length; i++) {
				var installedApp = installedApps[i];
				var installedName = (installedApp.manifest && installedApp.manifest.name) || '';
				var checkingName = app.name || '';
				
				var isMatch = false;
				if (app.type === 'hosted') {
					if (installedApp.manifestURL === app.manifest_url) {
						isMatch = true;
					}
				} else {
					var targetManifest = "app://" + app.id + "/manifest.webapp";
					if (installedApp.manifestURL === targetManifest || installedApp.manifestURL === app.manifest_url) {
						isMatch = true;
					}
				}
				
				// Fallback to matching by name (case-insensitive & trimmed) for extra robustness
				if (!isMatch && installedName && checkingName && installedName.toLowerCase().trim() === checkingName.toLowerCase().trim()) {
					isMatch = true;
				}
				
				if (isMatch) {
					appToUninstall = installedApp;
					break;
				}
			}
			
			if (appToUninstall) {
				console.log("Silently uninstalling previous version/conflicts for swapping to newer update: " + app.name);
				var uninstReq;
				if (navigator.mozApps.mgmt && typeof navigator.mozApps.mgmt.uninstall === 'function') {
					uninstReq = navigator.mozApps.mgmt.uninstall(appToUninstall);
				} else if (typeof appToUninstall.uninstall === 'function') {
					uninstReq = appToUninstall.uninstall();
				} else {
					console.warn("Silent uninstall API not available.");
					resolve();
					return;
				}
				
				uninstReq.onsuccess = function() {
					console.log("Silent uninstall completed.");
					resolve();
				};
				uninstReq.onerror = function() {
					console.error("Silent uninstall failed, continuing anyway.");
					resolve();
				};
			} else {
				resolve();
			}
		};
		request.onerror = function() {
			resolve();
		};
	});
}

function installFromApp(app, onProgress, forceClean) {
	return new Promise(function (resolve, reject) {
		if (!app) {
			reject('No app provided');
			return;
		}
		if (!navigator.mozApps) {
			// For testing in normal browsers, fallback
			var url = app.type === 'hosted' ? app.manifest_url : app.download_url;
			console.log('Would install ' + app.type + ' app from: ' + url);
			
			// Virtual installation persistence
			var virtualInstalled = JSON.parse(localStorage.getItem('virtual_installed_apps') || '{}');
			virtualInstalled[app.id] = {
				id: app.id,
				name: app.name,
				version: app.version || "1.0",
				manifestURL: app.manifest_url || ("app://" + app.id + "/manifest.webapp")
			};
			localStorage.setItem('virtual_installed_apps', JSON.stringify(virtualInstalled));
			
			alert('Successfully installed ' + app.name + '!\n(Testing fallback for non-KaiOS browsers)');
			resolve();
			return;
		}
		
		var downloadBlob = function(url, progressCb) {
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
				
				if (progressCb) {
					xhr.onprogress = function(e) {
						if (e.lengthComputable && e.total > 0) {
							var percent = Math.round((e.loaded / e.total) * 100);
							progressCb(percent);
						}
					};
				}
				
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

		var handleBlobPackagedInstall = function(app, onProgress, resolve, reject, forceClean) {
			if (!app.download_url) {
				reject('No download_url provided for packaged app');
				return;
			}

			var runPurgeAndInstall = function() {
				console.log('Initiating Clean Update Pipeline: Purging existing build first...');
				return backupAppPersistence(app).then(function(backups) {
					var recordCount = 0;
					backups.forEach(function(b) { recordCount += b.data.length; });
					
					if (recordCount > 0) {
						console.log('Backup successful! Records found: ' + recordCount + ' in ' + backups.length + ' databases.');
					} else if (activeBackup && activeBackup.length > 0) {
						console.log('Using pre-probed memory data as fallback...');
						backups = activeBackup;
					} else {
						console.log('No data found to back up.');
					}
					
					return uninstallSilently(app).then(function() {
						if (onProgress) {
							onProgress('downloading');
						}
						return downloadBlob(app.download_url, onProgress).then(function(blob) {
							if (onProgress) {
								onProgress('installing');
							}
							return new Promise(function(resImport, rejImport) {
								var importReq = navigator.mozApps.mgmt.import(blob);
								importReq.onsuccess = function() {
									console.log('Fresh package write succeeded. Restoring data...');
									restoreAppPersistence(backups).then(function() {
										console.log('Update pipeline successfully completed.');
										resImport();
									});
								};
								importReq.onerror = function() {
									rejImport(new Error('Import failed after purge: ' + (this.error ? this.error.name : 'Unknown system error')));
								};
							});
						});
					});
				});
			};

			if (forceClean) {
				runPurgeAndInstall().then(resolve).catch(reject);
			} else {
				console.log('Fetching binary OmniSD blob for in-place update...');
				downloadBlob(app.download_url, onProgress)
					.then(function(blob) {
						if (onProgress) {
							onProgress('installing');
						}
						
						if (navigator.mozApps.mgmt && typeof navigator.mozApps.mgmt.import === 'function') {
							var directRequest = navigator.mozApps.mgmt.import(blob);
							
							directRequest.onsuccess = function() {
								console.log('In-place zip import succeeded. Preserved user data.');
								resolve();
							};
							directRequest.onerror = function() {
								var errName = this.error ? this.error.name : 'Unknown system error';
								console.log('In-place zip import failed: ' + errName + '. Falling back to clean install...');
								
								// Check if app is already installed to determine if uninstallation is actually a data-loss risk
								checkAppStatus(app).then(function(status) {
									if (status.localApp) {
										showCustomConfirm('Clean Fallback', 'Direct update failed. Perform clean install? We will try to back up and restore your data.').then(function(confirmed) {
											if (confirmed) {
												backupAppPersistence(app).then(function(backups) {
													uninstallSilently(app).then(function() {
														var secondRequest = navigator.mozApps.mgmt.import(blob);
														secondRequest.onsuccess = function() {
															restoreAppPersistence(backups).then(function() {
																resolve();
															});
														};
														secondRequest.onerror = function() {
															reject('Import failed: ' + (this.error ? this.error.name : 'Unknown system error'));
														};
													});
												});
											} else {
												reject('Update canceled to protect your app data.');
											}
										});
									} else {
										// No local match detected, but direct import failed. Try clean install anyway.
										uninstallSilently(app).then(function() {
											var secondRequest = navigator.mozApps.mgmt.import(blob);
											secondRequest.onsuccess = resolve;
											secondRequest.onerror = function() {
												reject('Import failed: ' + (this.error ? this.error.name : 'Unknown system error'));
											};
										});
									}
								});
							};
						} else {
							reject('Privileged Management API missing. Is this device jailbroken?');
						}
					})
					.catch(function(err) {
						reject('Download failed: ' + err.message);
					});
			}
		};

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
			
			// Direct install first (non-destructive)
			request = navigator.mozApps.install(manifestUrl);
			request.onsuccess = resolve;
			request.onerror = function () {
				var errName = this.error ? this.error.name : 'Unknown error';
				console.log('Direct install failed: ' + errName + '. Trying fallback clean install.');
				
				// Fallback to clean install if allowed
				showCustomConfirm('Clean Install Fallback', 'Direct update of ' + app.name + ' failed with ' + errName + '. Perform clean install instead? WARNING: This will wipe your app data/saves.').then(function(confirmed) {
					if (confirmed) {
						uninstallSilently(app).then(function() {
							var secondRequest = navigator.mozApps.install(manifestUrl);
							secondRequest.onsuccess = resolve;
							secondRequest.onerror = function() {
								reject('Installing failed: ' + (this.error ? this.error.name : 'Unknown error'));
							};
						});
					} else {
						reject('Update canceled to protect your app data.');
					}
				});
			};
		} else {
			// Packaged App Flow
			// For third-party stores and sideloading, always use blob download + mgmt.import.
			// This avoids native installPackage manifestURL conflicts and has parity with WebIDE.
			handleBlobPackagedInstall(app, onProgress, resolve, reject, forceClean);
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
	renderCategories();
	renderAppsFiltered(apps);
}

function renderCategories() {
	var categoryContainer = document.getElementById('category-container');
	if (!categoryContainer) return;
	categoryContainer.innerHTML = '';
	
	categories.forEach(function(cat) {
		var item = document.createElement('div');
		item.className = 'category-item';
		if (cat === currentCategory) {
			item.classList.add('active');
		}
		item.textContent = cat;
		item.dataset.category = cat;
		
		item.addEventListener('click', function() {
			selectCategory(cat);
		});
		
		categoryContainer.appendChild(item);
	});
}

function selectCategory(cat) {
	if (currentCategory === cat) return;
	currentCategory = cat;
	
	// Update UI
	var items = document.querySelectorAll('.category-item');
	var container = document.getElementById('category-container');
	for (var i = 0; i < items.length; i++) {
		items[i].classList.remove('active');
		if (items[i].dataset.category === currentCategory) {
			items[i].classList.add('active');
			if (container) {
				scrollToCenterHorizontal(items[i], container);
			}
		}
	}
	
	// Retrigger filter
	triggerFilter();
}

function switchCategory(direction) {
	var index = categories.indexOf(currentCategory);
	if (direction === 'next') {
		index = (index + 1) % categories.length;
	} else {
		index = (index - 1 + categories.length) % categories.length;
	}
	selectCategory(categories[index]);
}

function triggerFilter() {
	var query = "";
	if (currentView === 'search') {
		var input = document.getElementById('search-view-input');
		query = input ? input.value.toLowerCase() : "";
	}
	
	var filteredApps = cachedApps.filter(function(app) {
		var matchesQuery = true;
		if (query) {
			matchesQuery = app.name.toLowerCase().indexOf(query) !== -1 || 
						   (app.author && app.author.toLowerCase().indexOf(query) !== -1) ||
						   (app.description && app.description.toLowerCase().indexOf(query) !== -1);
		}
		
		var matchesCategory = currentCategory === "All" || (app.category && app.category.toLowerCase() === currentCategory.toLowerCase());
		
		return matchesQuery && matchesCategory;
	});
	
	if (currentView === 'search') {
		renderSearchResults(filteredApps);
	} else {
		renderAppsFiltered(filteredApps);
	}
}

function renderSearchResults(apps) {
	var container = document.getElementById('search-results-list');
	if (!container) return;
	container.innerHTML = '';
	
	if (apps.length === 0) {
		var msg = document.createElement('div');
		msg.className = 'message';
		msg.textContent = 'No matching apps found.';
		container.appendChild(msg);
		return;
	}

	apps.forEach(function(app) {
		var index = cachedApps.indexOf(app);
		var item = document.createElement('div');
		item.className = 'app-card';
		item.tabIndex = 0;
		item.dataset.index = index;
		var typeLabel = (app.type === 'hosted' ? 'Hosted' : 'Packaged');
		item.innerHTML = '<img src="' + (app.icon || 'icon.svg') + '" class="app-icon"><div class="app-info"><h2 class="app-title">' + app.name + '</h2><div class="app-category-label">' + (app.category || 'App') + '</div><span class="badge badge-' + (app.type || 'packaged') + '">' + typeLabel + '</span></div><div class="free-label">Free</div>';
		item.onclick = function() {
			hideSearchView();
			showDetails(index);
		};
		container.appendChild(item);
		updateCardInstallationStatus(item, app);
	});
}

function showSearchView() {
	var prevView = currentView;
	currentView = 'search';
	document.getElementById('app-content').classList.add('hidden');
	document.getElementById('view-search').classList.remove('hidden');
	
	var input = document.getElementById('search-view-input');
	input.value = '';
	input.focus();
	
	document.getElementById('softkey-left').textContent = 'BACK';
	document.getElementById('softkey-center').textContent = 'SELECT';
	document.getElementById('softkey-right').textContent = 'CLEAR';
	
	triggerFilter();
}

function hideSearchView() {
	currentView = 'list';
	document.getElementById('view-search').classList.add('hidden');
	document.getElementById('app-content').classList.remove('hidden');
	updateListSoftkeys();
	
	var cards = document.querySelectorAll('.app-card');
	if (cards.length > 0) cards[0].focus();
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
		
		var typeLabel = (app.type === 'hosted' ? 'Hosted' : 'Packaged');
		card.innerHTML = '<img src="' + (app.icon || 'icon.svg') + '" class="app-icon">' + 
						 '<div class="app-info">' + 
						 '<h2 class="app-title">' + app.name + '</h2>' + 
						 '<div class="app-category-label">' + (app.category || 'App') + '</div>' + 
						 '<span class="badge badge-' + (app.type || 'packaged') + '">' + typeLabel + '</span>' +
						 '</div>' + 
						 '<div class="free-label">Free</div>';
		
		card.addEventListener('click', function() {
			showDetails(index);
		});
		
		listContainer.appendChild(card);
		updateCardInstallationStatus(card, app);
	});
	
	// Initialize focus handling
	initSpatialNavigation();
}

function initSpatialNavigation() {
	var cards = document.querySelectorAll('.app-card');
	
	if (cards.length > 0 && currentView === 'list') {
		cards[0].focus();
	}
	
	for (var i = 0; i < cards.length; i++) {
		(function(card) {
			card.addEventListener('focus', function() {
				updateListSoftkeys();
			});
		})(cards[i]);
	}
	updateListSoftkeys();
}

function scrollToCenter(element, container) {
	// 1. Get the top position of the element relative to the container
	var elementTop = element.offsetTop;
	
	// 2. Get the dimensions
	var elementHeight = element.offsetHeight;
	var containerHeight = container.clientHeight;

	// 3. The Math:
	// elementTop: puts the item at the very top of the container.
	// - (containerHeight / 2): moves the scroll point up by half the container height (centering the view).
	// + (elementHeight / 2): adjusts for the item's own height so its center aligns with the container's center.
	var targetScrollPos = elementTop - (containerHeight / 2) + (elementHeight / 2);

	// 4. Apply the scroll position to the container
	container.scrollTop = targetScrollPos;
}

function scrollToCenterHorizontal(element, container) {
	// 1. Get the left position of the element relative to the container
	var elementLeft = element.offsetLeft;
	
	// 2. Get the dimensions
	var elementWidth = element.offsetWidth;
	var containerWidth = container.clientWidth;

	// 3. The Math:
	// elementLeft: puts the item at the very left of the container.
	// - (containerWidth / 2): moves the scroll point left by half the container width (centering the view).
	// + (elementWidth / 2): adjusts for the item's own width so its center aligns with the container's center.
	var targetScrollPos = elementLeft - (containerWidth / 2) + (elementWidth / 2);

	// 4. Apply the scroll position to the container
	container.scrollLeft = targetScrollPos;
}

// Global capturing focus listener to center focused elements
document.addEventListener('focus', function(e) {
	if (e.target && e.target.classList) {
		if (e.target.classList.contains('app-card')) {
			var container = null;
			if (currentView === 'list') {
				container = document.getElementById('app-content');
			} else if (currentView === 'search') {
				container = document.getElementById('view-search');
			}
			if (container) {
				scrollToCenter(e.target, container);
			}
		} else if (e.target.classList.contains('category-item')) {
			var container = document.getElementById('category-container');
			if (container) {
				scrollToCenterHorizontal(e.target, container);
			}
		}
	}
}, true);

// Global state declared at top level of scope

function getAppVersion(localApp) {
	if (!localApp) return "1.0";
	var manifest = localApp.manifest || localApp.updateManifest;
	if (manifest) {
		if (typeof manifest === 'string') {
			try {
				manifest = JSON.parse(manifest);
			} catch (e) {
				console.error("Failed to parse manifest string:", e);
			}
		}
		if (manifest && manifest.version) {
			return manifest.version;
		}
	}
	return "1.0";
}

function compareVersions(v1, v2) {
	var parts1 = String(v1).split('.');
	var parts2 = String(v2).split('.');
	var length = Math.max(parts1.length, parts2.length);
	for (var i = 0; i < length; i++) {
		var p1 = parseInt(parts1[i], 10) || 0;
		var p2 = parseInt(parts2[i], 10) || 0;
		if (p1 > p2) return 1;
		if (p1 < p2) return -1;
	}
	return 0;
}

function checkAppStatus(app) {
	return new Promise(function(resolve) {
		if (!navigator.mozApps || !navigator.mozApps.mgmt) {
			var virtualInstalled = JSON.parse(localStorage.getItem('virtual_installed_apps') || '{}');
			if (virtualInstalled[app.id]) {
				var localVer = virtualInstalled[app.id].version || "1.0";
				var serverVer = app.version || "1.0";
				if (compareVersions(serverVer, localVer) > 0) {
					resolve({ localApp: virtualInstalled[app.id], state: 'UPDATE' });
				} else {
					resolve({ localApp: virtualInstalled[app.id], state: 'OPEN' });
				}
			} else {
				resolve({ localApp: null, state: 'INSTALL' });
			}
			return;
		}
		
		var request = navigator.mozApps.mgmt.getAll();
		request.onsuccess = function() {
			var installedApps = this.result || [];
			var localApp = null;
			
			for (var i = 0; i < installedApps.length; i++) {
				var installedApp = installedApps[i];
				var installedName = (installedApp.manifest && installedApp.manifest.name) || 
				                    (installedApp.updateManifest && installedApp.updateManifest.name) || '';
				var checkingName = app.name || '';
				
				var isMatch = false;
				if (app.type === 'hosted') {
					if (installedApp.manifestURL === app.manifest_url) {
						isMatch = true;
					}
				} else {
					var targetManifest = "app://" + app.id + "/manifest.webapp";
					if (installedApp.manifestURL === targetManifest || installedApp.manifestURL === app.manifest_url) {
						isMatch = true;
					}
				}
				
				// Fallback to matching by name (case-insensitive & trimmed) for extra robustness
				if (!isMatch && installedName && checkingName && installedName.toLowerCase().trim() === checkingName.toLowerCase().trim()) {
					isMatch = true;
				}
				
				if (isMatch) {
					localApp = installedApp;
					break;
				}
			}
			
			if (!localApp) {
				resolve({ localApp: null, state: 'INSTALL' });
			} else {
				var localVersion = getAppVersion(localApp);
				var serverVersion = app.version || "1.0";
				
				if (compareVersions(serverVersion, localVersion) > 0) {
					resolve({ localApp: localApp, state: 'UPDATE' });
				} else {
					resolve({ localApp: localApp, state: 'OPEN' });
				}
			}
		};
		request.onerror = function() {
			resolve({ localApp: null, state: 'INSTALL' });
		};
	});
}

function refreshAppStatusMultipleTimes(app) {
	var checkAndUpdate = function() {
		checkAppStatus(app).then(function(result) {
			if (currentView === 'details' && cachedApps[currentAppIndex] && cachedApps[currentAppIndex].id === app.id) {
				updateDetailViewUI(app, result.state, result.localApp);
			}
			updateAllListCardStatuses();
		});
	};
	
	// Check immediately
	checkAndUpdate();
	
	// Check after 500ms, 1500ms, and 3000ms to handle index/db delays on lower-tier KaiOS builds
	setTimeout(checkAndUpdate, 500);
	setTimeout(checkAndUpdate, 1500);
	setTimeout(checkAndUpdate, 3000);
}

function updateCardInstallationStatus(card, app) {
	checkAppStatus(app).then(function(status) {
		var labelEl = card.querySelector('.free-label, .installed-label');
		if (labelEl) {
			if (status.state === 'OPEN') {
				labelEl.className = 'installed-label';
				labelEl.textContent = 'Installed';
			} else if (status.state === 'UPDATE') {
				labelEl.className = 'installed-label';
				labelEl.textContent = 'Update';
			} else {
				labelEl.className = 'free-label';
				labelEl.textContent = 'Free';
			}
		}
	});
}

function updateAllListCardStatuses() {
	var cards = document.querySelectorAll('.app-card');
	for (var i = 0; i < cards.length; i++) {
		var idx = parseInt(cards[i].dataset.index, 10);
		if (idx >= 0 && cachedApps[idx]) {
			updateCardInstallationStatus(cards[i], cachedApps[idx]);
		}
	}
}

function updateDetailViewUI(app, state, localApp) {
	currentAppState = state;
	currentLocalApp = localApp;
	
	var getBtn = document.getElementById('get-btn');
	
	if (state === 'INSTALL') {
		document.getElementById('softkey-left').textContent = '';
		document.getElementById('softkey-center').textContent = 'INSTALL';
		if (getBtn) getBtn.textContent = 'INSTALL';
	} else if (state === 'UPDATE') {
		document.getElementById('softkey-left').textContent = 'UNINSTALL';
		document.getElementById('softkey-center').textContent = 'UPDATE';
		if (getBtn) getBtn.textContent = 'UPDATE';
	} else if (state === 'OPEN') {
		document.getElementById('softkey-left').textContent = 'UNINSTALL';
		document.getElementById('softkey-center').textContent = 'OPEN';
		if (getBtn) getBtn.textContent = 'OPEN';
	}
	document.getElementById('softkey-right').textContent = 'BACK';
}

function getHostedAppLaunchUrl(app) {
	var manifestUrl = app.manifest_url;
	if (!manifestUrl) return "";
	
	var baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/'));
	return baseUrl + "/";
}

function showAppPlayer(url) {
	currentView = 'player';
	var player = document.getElementById('view-app-player');
	var iframe = document.getElementById('app-player-iframe');
	if (player && iframe) {
		iframe.src = url;
		player.classList.remove('hidden');
		iframe.focus();
		
		// Hide other views
		document.getElementById('view-details').classList.add('hidden');
		document.getElementById('app-content').classList.add('hidden');
		document.getElementById('softkey-bar').classList.add('hidden');
	}
}

function closeAppPlayer() {
	currentView = 'details';
	var player = document.getElementById('view-app-player');
	var iframe = document.getElementById('app-player-iframe');
	if (player && iframe) {
		iframe.src = 'about:blank';
		player.classList.add('hidden');
		
		// Unhide details and softkey bar
		document.getElementById('view-details').classList.remove('hidden');
		document.getElementById('softkey-bar').classList.remove('hidden');
		
		// Refocus detail action button
		var getBtn = document.getElementById('get-btn');
		if (getBtn) {
			getBtn.focus();
		}
	}
}

function openApp(appId, app, localApp) {
	if (app && app.type === 'hosted') {
		var launchUrl = getHostedAppLaunchUrl(app);
		if (launchUrl) {
			console.log("Opening hosted app inside App Player: " + launchUrl);
			showAppPlayer(launchUrl);
			return;
		}
	}

	if (localApp && typeof localApp.launch === 'function') {
		console.log("Launching app via localApp.launch()...");
		localApp.launch();
		return;
	}
	
	if (!window.MozActivity) {
		console.log("Web Activities are not supported in this environment.");
		alert("Opening apps not supported in this browser. App ID: " + appId);
		return;
	}

	console.log("Launching app via MozActivity...");
	var manifestURL = app.type === 'hosted' ? app.manifest_url : ("app://" + appId + "/manifest.webapp");
	try {
		var activity = new window.MozActivity({
			name: "open",
			data: {
				type: "window",
				manifestURL: manifestURL
			}
		});

		activity.onsuccess = function() {
			console.log("App launched successfully!");
		};

		activity.onerror = function() {
			alert("Failed to open app. Is it installed correctly?");
		};
	} catch (e) {
		alert("Error starting activity: " + e.message);
	}
}

function uninstallApp(app, onSuccess) {
	if (!navigator.mozApps || !navigator.mozApps.mgmt) {
		showCustomConfirm("Uninstall App", "Are you sure you want to uninstall " + app.name + "?").then(function(confirmed) {
			if (!confirmed) return;
			var virtualInstalled = JSON.parse(localStorage.getItem('virtual_installed_apps') || '{}');
			if (virtualInstalled[app.id]) {
				delete virtualInstalled[app.id];
				localStorage.setItem('virtual_installed_apps', JSON.stringify(virtualInstalled));
				alert("Application successfully removed.");
				if (onSuccess) onSuccess();
			} else {
				alert("App is not installed.");
			}
		});
		return;
	}

	showCustomConfirm("Uninstall App", "Are you sure you want to uninstall " + app.name + "?").then(function(confirmed) {
		if (!confirmed) return;

		var request = navigator.mozApps.mgmt.getAll();

		request.onsuccess = function() {
			var installedApps = this.result || [];
			var appToUninstall = null;

			for (var i = 0; i < installedApps.length; i++) {
				var installedApp = installedApps[i];
				var installedName = (installedApp.manifest && installedApp.manifest.name) || '';
				var checkingName = app.name || '';
				
				var isMatch = false;
				if (app.type === 'hosted') {
					if (installedApp.manifestURL === app.manifest_url) {
						isMatch = true;
					}
				} else {
					var targetManifest = "app://" + app.id + "/manifest.webapp";
					if (installedApp.manifestURL === targetManifest || installedApp.manifestURL === app.manifest_url) {
						isMatch = true;
					}
				}
				
				// Fallback to matching by name (case-insensitive & trimmed) for extra robustness
				if (!isMatch && installedName && checkingName && installedName.toLowerCase().trim() === checkingName.toLowerCase().trim()) {
					isMatch = true;
				}
				
				if (isMatch) {
					appToUninstall = installedApp;
					break;
				}
			}

			if (appToUninstall) {
				var uninstReq;
				// Check if standard B2G mgmt.uninstall API is available, otherwise fall back to DOMApplication.uninstall method
				if (navigator.mozApps.mgmt && typeof navigator.mozApps.mgmt.uninstall === 'function') {
					console.log("Using navigator.mozApps.mgmt.uninstall(app) to uninstall...");
					uninstReq = navigator.mozApps.mgmt.uninstall(appToUninstall);
				} else if (typeof appToUninstall.uninstall === 'function') {
					console.log("Using appToUninstall.uninstall() to uninstall...");
					uninstReq = appToUninstall.uninstall();
				} else {
					alert("Uninstall function not available. If you are on KaiOS 3.0+, use the standard system application launcher.");
					return;
				}
				
				uninstReq.onsuccess = function() {
					alert("Application successfully removed.");
					if (onSuccess) onSuccess();
				};
				
				uninstReq.onerror = function() {
					alert("Uninstall failed: " + (this.error ? this.error.name : 'Unknown error'));
				};
			} else {
				alert("This application is not installed on this device.");
			}
		};

		request.onerror = function() {
			alert("Failed to query system applications registry.");
		};
	});
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
	
	var hero = document.createElement('div');
	hero.className = 'details-hero';
	var typeLabel = (app.type === 'hosted' ? 'Hosted' : 'Packaged');
	hero.innerHTML = '<img src="' + (app.icon || 'icon.svg') + '" class="app-icon">' + 
					 '<div class="app-info"><h2 class="app-title">' + app.name + '</h2>' + 
					 '<div class="app-category-label">' + (app.category || 'App') + '</div>' +
					 '<span class="badge badge-' + (app.type || 'packaged') + '">' + typeLabel + '</span>' +
					 '</div>' + 
					 '<div class="free-label">Free</div>';
	
	var actionBar = document.createElement('div');
	actionBar.className = 'details-action-bar';
	var getBtn = document.createElement('div');
	getBtn.id = 'get-btn';
	getBtn.className = 'details-get-btn';
	getBtn.tabIndex = 0;
	getBtn.textContent = 'INSTALL';
	getBtn.onclick = function() { initiateAppAction(); };
	actionBar.appendChild(getBtn);
	
	var content = document.createElement('div');
	content.className = 'details-content';
	
	var desc = document.createElement('div');
	desc.className = 'details-description';
	desc.textContent = app.description || 'No description.';

	content.appendChild(desc);

	// Information Section
	var infoSection = document.createElement('div');
	infoSection.className = 'details-info-section';
	infoSection.innerHTML = '<div class="info-title">Information</div>' +
		'<div class="info-row"><span class="info-label">Version</span><span class="info-value">' + (app.version || '1.0.0') + '</span></div>' +
		'<div class="info-row"><span class="info-label">Size</span><span class="info-value">' + (app.size || 'N/A') + '</span></div>' +
		'<div class="info-row"><span class="info-label">Developer</span><span class="info-value">' + (app.author || 'Unknown') + '</span></div>';
	
	content.appendChild(infoSection);
	
	detailsView.appendChild(hero);
	detailsView.appendChild(actionBar);
	detailsView.appendChild(content);

	getBtn.focus();
	
	document.getElementById('softkey-left').textContent = '';
	document.getElementById('softkey-center').textContent = 'SELECT';
	document.getElementById('softkey-right').textContent = 'BACK';
	
	checkAppStatus(app).then(function(result) {
		if (currentView === 'details' && currentAppIndex === index) {
			updateDetailViewUI(app, result.state, result.localApp);
		}
	});
}

function initiateAppAction() {
	var app = cachedApps[currentAppIndex];
	if (currentAppState === 'INSTALL' || currentAppState === 'UPDATE') {
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
	} else if (currentAppState === 'OPEN') {
		openApp(app.id, app, currentLocalApp);
	}
}

function hideDetails() {
	currentView = 'list';
	document.getElementById('view-details').classList.add('hidden');
	document.getElementById('app-content').classList.remove('hidden');
	
	updateListSoftkeys();
	updateAllListCardStatuses();
	
	var cards = document.querySelectorAll('.app-card');
	var targetCard = null;
	if (currentAppIndex !== -1) {
		for (var i = 0; i < cards.length; i++) {
			if (parseInt(cards[i].dataset.index, 10) === currentAppIndex) {
				targetCard = cards[i];
				break;
			}
		}
	}
	if (!targetCard && cards.length > 0) {
		targetCard = cards[0];
	}
	if (targetCard) {
		targetCard.focus();
	}
}

function updateListSoftkeys() {
	if (currentView !== 'list') return;
	
	document.getElementById('softkey-left').textContent = '';
	document.getElementById('softkey-center').textContent = 'VIEW';
	document.getElementById('softkey-right').textContent = 'SEARCH';
}

document.addEventListener('keydown', function(e) {
	// 0. Player / Application Viewer View Key Event Handling
	if (currentView === 'player') {
		if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'SoftRight' || e.key === 'F2') {
			e.preventDefault();
			closeAppPlayer();
		}
		return;
	}

	// 1. Details View Key Event Handling
	if (currentView === 'details') {
		if (e.key === 'Backspace' || e.key === 'Escape' || e.key === 'SoftRight' || e.key === 'F2') {
			e.preventDefault();
			hideDetails();
			return;
		}
		
		var app = cachedApps[currentAppIndex];
		
		if (e.key === 'SoftLeft' || e.key === 'F1') {
			e.preventDefault();
			if (currentAppState === 'OPEN' || currentAppState === 'UPDATE') {
				uninstallApp(app, function() {
					refreshAppStatusMultipleTimes(app);
				});
			}
			return;
		}
		
		if (e.key === 'Enter') {
			e.preventDefault();
			if (currentAppState === 'INSTALL' || currentAppState === 'UPDATE') {
				var getBtn = document.getElementById('get-btn');
				
				var proceedWithInstall = function(forceClean) {
					if (getBtn) {
						getBtn.textContent = 'DOWNLOADING...';
					}
					document.getElementById('softkey-center').textContent = 'WAIT...';
					
					installFromApp(app, function(percent) {
						if (getBtn) {
							if (percent === 'installing') {
								getBtn.textContent = 'INSTALLING...';
							} else if (typeof percent === 'number') {
								getBtn.textContent = 'DOWNLOADING ' + percent + '%';
							}
						}
					}, forceClean).then(function() {
						alert('Installed successfully!');
						refreshAppStatusMultipleTimes(app);
					}).catch(function(err) {
						alert(err);
						refreshAppStatusMultipleTimes(app);
					});
				};
				
				if (currentAppState === 'UPDATE') {
					showCustomConfirm('Clean Update?', 'Do a clean rewrite update? Prevents system hangs. We will try to back up and restore your data.').then(function(cleanRequested) {
						proceedWithInstall(cleanRequested);
					});
				} else {
					proceedWithInstall(false);
				}
			} else if (currentAppState === 'OPEN') {
				openApp(app.id, app, currentLocalApp);
			}
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

	// 2. Main List View Key Event Handling
	if (currentView !== 'list') return;

	var active = document.activeElement;
	var isCard = active && active.classList.contains('app-card');
	
	var cards = Array.from(document.querySelectorAll('#app-list .app-card'));
	var currentIndex = isCard ? cards.indexOf(active) : -1;
	
	if (e.key === 'SoftRight' || e.key === 'F2') {
		e.preventDefault();
		showSearchView();
		return;
	}
	
	switch(e.key) {
		case 'ArrowDown':
			e.preventDefault();
			if (currentIndex < cards.length - 1) {
				cards[currentIndex + 1].focus();
			}
			break;
		case 'ArrowUp':
			e.preventDefault();
			if (currentIndex > 0) {
				cards[currentIndex - 1].focus();
			}
			break;
		case 'ArrowRight':
			e.preventDefault();
			switchCategory('next');
			break;
		case 'ArrowLeft':
			e.preventDefault();
			switchCategory('prev');
			break;
		case 'Enter':
			if (isCard) {
				e.preventDefault();
				active.click();
			}
			break;
	}
});

// 3. Search View Input Handling
window.addEventListener('DOMContentLoaded', function() {
	var searchInput = document.getElementById('search-view-input');
	if (searchInput) {
		searchInput.addEventListener('input', function() {
			triggerFilter();
		});
		
		searchInput.addEventListener('keydown', function(e) {
			if (currentView !== 'search') return;
			
			if (e.key === 'ArrowDown') {
				var results = document.querySelectorAll('#search-results-list .app-card');
				if (results.length > 0) {
					results[0].focus();
					e.preventDefault();
				}
			} else if (e.key === 'SoftLeft' || e.key === 'F1' || e.key === 'Backspace') {
				if (e.key === 'Backspace' && searchInput.value.length > 0) return;
				e.preventDefault();
				hideSearchView();
			} else if (e.key === 'SoftRight' || e.key === 'F2') {
				e.preventDefault();
				searchInput.value = '';
				triggerFilter();
			}
		});
	}
	
	// Delegate ArrowUp from search results back to input
	document.addEventListener('keydown', function(e) {
		if (currentView !== 'search') return;
		var active = document.activeElement;
		if (active && active.parentElement && active.parentElement.id === 'search-results-list') {
			var results = Array.from(document.querySelectorAll('#search-results-list .app-card'));
			var idx = results.indexOf(active);
			
			if (e.key === 'ArrowUp' && idx === 0) {
				document.getElementById('search-view-input').focus();
				e.preventDefault();
			} else if (e.key === 'ArrowUp' && idx > 0) {
				results[idx - 1].focus();
				e.preventDefault();
			} else if (e.key === 'ArrowDown' && idx < results.length - 1) {
				results[idx + 1].focus();
				e.preventDefault();
			} else if (e.key === 'SoftLeft' || e.key === 'F1' || e.key === 'Backspace') {
				e.preventDefault();
				hideSearchView();
			}
		}
	});
});

function loadRegistry() {
	var loaddiv = document.getElementById('loading');
	var errordiv = document.getElementById('error');
	
	// Append cache-buster timestamp query string to fully bypass any local/CDN HTTP caches on GitHub raw domain
	var cacheBustedUrl = REGISTRY_URL + '?t=' + Date.now();
	
	var fetchPromise;
	try {
		fetchPromise = fetch(cacheBustedUrl, { cache: 'no-cache' });
	} catch (e) {
		fetchPromise = fetch(cacheBustedUrl);
	}
	
	fetchPromise
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
	// Register global B2G application management system event listeners
	if (navigator.mozApps && navigator.mozApps.mgmt) {
		navigator.mozApps.mgmt.oninstall = function(event) {
			console.log("System-wide app installed event received:", (event.application && event.application.manifestURL));
			if (currentView === 'details' && cachedApps[currentAppIndex]) {
				refreshAppStatusMultipleTimes(cachedApps[currentAppIndex]);
			}
		};
		navigator.mozApps.mgmt.onuninstall = function(event) {
			console.log("System-wide app uninstalled event received:", (event.application && event.application.manifestURL));
			if (currentView === 'details' && cachedApps[currentAppIndex]) {
				refreshAppStatusMultipleTimes(cachedApps[currentAppIndex]);
			}
		};
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
