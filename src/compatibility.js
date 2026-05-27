(function() {
  var unsupported = [];
  if (typeof Promise === 'undefined') unsupported.push('Promise');
  if (typeof fetch === 'undefined') unsupported.push('fetch');
  if (!navigator.mozApps) unsupported.push('navigator.mozApps (KaiOS/Firefox OS App API)');
  
  if (unsupported.length > 0) {
    alert("Warning: The following required features are not natively supported by your browser: \n" + unsupported.join('\n'));
  }
})();
