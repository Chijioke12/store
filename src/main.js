/*global Promise, alert*/
(function () {
"use strict";

var REGISTRY_URL = 'https://raw.githubusercontent.com/Chijioke12/Open-KaiStore-Registry/refs/heads/main/apps.json';

var currentView = 'list';
var cachedApps = [];
var currentAppIndex = -1;

var currentAppState = 'INSTALL';
var currentLocalApp = null;

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
			alert('Would install ' + app.type + ' app from: ' + url + '\n(mozApps API not available in this browser)');
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

			console.log('Fetching binary OmniSD blob from:', app.download_url);
			
			downloadBlob(app.download_url, onProgress)
				.then(function(blob) {
					if (onProgress) {
						onProgress('installing');
					}
					
					if (navigator.mozApps.mgmt && typeof navigator.mozApps.mgmt.import === 'function') {
						if (forceClean) {
							console.log('Force Clean Update Purge: removing existing build first...');
							uninstallSilently(app).then(function() {
								if (onProgress) {
									onProgress('installing');
								}
								var secondRequest = navigator.mozApps.mgmt.import(blob);
								secondRequest.onsuccess = function() {
									console.log('Clean write succeeded!');
									resolve();
								};
								secondRequest.onerror = function() {
									reject('Import failed after purge: ' + (this.error ? this.error.name : 'Unknown system error'));
								};
							});
						} else {
							var directRequest = navigator.mozApps.mgmt.import(blob);
							
							directRequest.onsuccess = function() {
								console.log('In-place zip import succeeded. Preserved user data.');
								resolve();
							};
							directRequest.onerror = function() {
								var errName = this.error ? this.error.name : 'Unknown system error';
								console.log('In-place zip import failed: ' + errName + '. Checking app status.');
								
								// Check if app is already installed to determine if uninstallation is actually a data-loss risk
								checkAppStatus(app).then(function(status) {
									if (status.localApp) {
										// Destructive update warning
										showCustomConfirm('Clean Fallback', 'Direct update of ' + app.name + ' failed (' + errName + '). Perform clean install instead? WARNING: Wipes saves.').then(function(confirmed) {
											if (confirmed) {
												uninstallSilently(app).then(function() {
													if (onProgress) {
														onProgress('installing');
													}
													var secondRequest = navigator.mozApps.mgmt.import(blob);
													secondRequest.onsuccess = function() {
														resolve();
													};
													secondRequest.onerror = function() {
														reject('Import failed: ' + (this.error ? this.error.name : 'Unknown system error'));
													};
												});
											} else {
												reject('Update canceled to protect your app data.');
											}
										});
									} else {
										// No local match detected, but direct import failed. Try clean install as a fallback.
										uninstallSilently(app).then(function() {
											if (onProgress) {
												onProgress('installing');
											}
											var secondRequest = navigator.mozApps.mgmt.import(blob);
											secondRequest.onsuccess = function() {
												resolve();
											};
											secondRequest.onerror = function() {
												reject('Import failed: ' + (this.error ? this.error.name : 'Unknown system error'));
											};
										});
									}
								});
							};
						}
					} else {
						reject('Privileged Management API missing. Is this device jailbroken?');
					}
				})
				.catch(function(err) {
					reject('Download failed: ' + err.message);
				});
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
		
		var metaRow = document.createElement('div');
		metaRow.className = 'app-meta-row';
		
		var author = document.createElement('p');
		author.className = 'app-author';
		author.textContent = app.author || 'Unknown Author';
		
		var typeBadge = document.createElement('span');
		typeBadge.className = 'badge ' + (app.type === 'hosted' ? 'badge-hosted' : 'badge-packaged');
		typeBadge.textContent = app.type === 'hosted' ? 'Hosted' : 'Packaged';
		
		metaRow.appendChild(author);
		metaRow.appendChild(typeBadge);
		
		info.appendChild(title);
		info.appendChild(metaRow);
		header.appendChild(icon);
		header.appendChild(info);
		
		card.addEventListener('click', function() {
			showDetails(index);
		});
		
		card.appendChild(header);
		
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
			resolve({ localApp: null, state: 'INSTALL' });
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
		});
	};
	
	// Check immediately
	checkAndUpdate();
	
	// Check after 500ms, 1500ms, and 3000ms to handle index/db delays on lower-tier KaiOS builds
	setTimeout(checkAndUpdate, 500);
	setTimeout(checkAndUpdate, 1500);
	setTimeout(checkAndUpdate, 3000);
}

function updateDetailViewUI(app, state, localApp) {
	currentAppState = state;
	currentLocalApp = localApp;
	
	var statusIndicator = document.getElementById('details-status-indicator');
	if (statusIndicator) {
		statusIndicator.className = 'badge-status'; // Reset base status classes
		if (state === 'INSTALL') {
			statusIndicator.textContent = 'Status: Not Installed';
			statusIndicator.classList.add('badge-status-install');
			statusIndicator.style.color = '';
		} else if (state === 'UPDATE') {
			var localVersion = getAppVersion(localApp);
			statusIndicator.textContent = 'Status: Update Available (Installed: ' + localVersion + ', Server: ' + (app.version || '1.0') + ')';
			statusIndicator.classList.add('badge-status-update');
			statusIndicator.style.color = '';
		} else if (state === 'OPEN') {
			var installedVersion = getAppVersion(localApp);
			statusIndicator.textContent = 'Status: Installed (v' + installedVersion + ')';
			statusIndicator.classList.add('badge-status-open');
			statusIndicator.style.color = '';
		}
	}
	
	if (state === 'INSTALL') {
		document.getElementById('softkey-left').textContent = '';
		document.getElementById('softkey-center').textContent = 'INSTALL';
	} else if (state === 'UPDATE') {
		document.getElementById('softkey-left').textContent = 'UNINSTALL';
		document.getElementById('softkey-center').textContent = 'UPDATE';
	} else if (state === 'OPEN') {
		document.getElementById('softkey-left').textContent = 'UNINSTALL';
		document.getElementById('softkey-center').textContent = 'OPEN';
	}
	document.getElementById('softkey-right').textContent = 'BACK';
}

function openApp(appId, app, localApp) {
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
		alert("Management API not available.");
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
	
	var icon = document.createElement('img');
	icon.className = 'app-icon';
	icon.src = app.icon || 'icon.svg';
	icon.onerror = function() { this.src = 'icon.svg'; };
	
	var title = document.createElement('h2');
	title.className = 'app-title';
	title.textContent = app.name;
	
	var author = document.createElement('p');
	author.className = 'app-author';
	author.textContent = app.author || 'Unknown Author';
	
	var metaContainer = document.createElement('div');
	metaContainer.className = 'details-meta-container';
	
	var typeBadge = document.createElement('span');
	typeBadge.className = 'badge ' + (app.type === 'hosted' ? 'badge-hosted' : 'badge-packaged');
	typeBadge.textContent = app.type === 'hosted' ? 'Hosted' : 'Packaged';
	metaContainer.appendChild(typeBadge);
	
	var versionBadge = document.createElement('span');
	versionBadge.className = 'badge badge-version';
	versionBadge.textContent = 'v' + (app.version || '1.0');
	metaContainer.appendChild(versionBadge);
	
	hero.appendChild(icon);
	hero.appendChild(title);
	hero.appendChild(author);
	hero.appendChild(metaContainer);
	
	var descCard = document.createElement('div');
	descCard.className = 'details-description-card';
	
	var descTitle = document.createElement('div');
	descTitle.className = 'details-section-title';
	descTitle.textContent = 'About';
	
	var desc = document.createElement('div');
	desc.className = 'details-description';
	desc.textContent = app.description || 'No description available.';
	
	descCard.appendChild(descTitle);
	descCard.appendChild(desc);
	
	detailsView.appendChild(hero);
	detailsView.appendChild(descCard);
	
	var statusIndicator = document.createElement('div');
	statusIndicator.id = 'details-status-indicator';
	statusIndicator.className = 'badge-status badge-status-install';
	statusIndicator.textContent = 'Checking device status...';
	detailsView.appendChild(statusIndicator);
	
	document.getElementById('softkey-left').textContent = '';
	document.getElementById('softkey-center').textContent = '';
	document.getElementById('softkey-right').textContent = 'BACK';
	
	checkAppStatus(app).then(function(result) {
		if (currentView === 'details' && currentAppIndex === index) {
			updateDetailViewUI(app, result.state, result.localApp);
		}
	});
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

function updateListSoftkeys() {
	if (currentView !== 'list') return;
	
	var active = document.activeElement;
	var isSearch = active && active.id === 'search-input';
	
	document.getElementById('softkey-left').textContent = '';
	
	if (isSearch) {
		document.getElementById('softkey-center').textContent = 'SEARCH';
		document.getElementById('softkey-right').textContent = '';
	} else {
		document.getElementById('softkey-center').textContent = 'VIEW';
		document.getElementById('softkey-right').textContent = 'SEARCH';
	}
}

document.addEventListener('keydown', function(e) {
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
				var statusIndicator = document.getElementById('details-status-indicator');
				
				var proceedWithInstall = function(forceClean) {
					if (statusIndicator) {
						statusIndicator.textContent = 'Starting download...';
						statusIndicator.style.color = '#3498db';
					}
					document.getElementById('softkey-center').textContent = 'WAIT...';
					
					installFromApp(app, function(percent) {
						if (statusIndicator) {
							if (percent === 'installing') {
								statusIndicator.textContent = 'Swapping & Installing...';
							} else {
								statusIndicator.textContent = 'Downloading: ' + percent + '%';
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
					showCustomConfirm('Clean Update?', 'Do a clean rewrite update? Prevents B2G system hangs, but will wipe app data/saves.').then(function(cleanRequested) {
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
	var active = document.activeElement;
	var isCard = active && active.classList.contains('app-card');
	var isSearch = active && active.id === 'search-input';
	var cards = Array.from(document.querySelectorAll('.app-card'));
	var currentIndex = cards.indexOf(active);
	
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
