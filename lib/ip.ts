export function getCleanIp(request: Request): string {
  try {
    const xForwardedFor = request.headers.get('x-forwarded-for');
    let ip = '';
    if (xForwardedFor) {
      ip = xForwardedFor.split(',')[0].trim();
    } else {
      ip = request.headers.get('x-real-ip') || '127.0.0.1';
    }

    // Strip port if present (e.g. [2409:...]:12345 or 127.0.0.1:12345)
    if (ip.includes(']')) {
      // IPv6 with port like [2001:db8::1]:8080
      const match = ip.match(/^\[(.*)\]:\d+$/);
      if (match) ip = match[1];
    } else if (ip.includes(':') && ip.split(':').length === 2) {
      // IPv4 with port like 127.0.0.1:8080
      ip = ip.split(':')[0];
    }

    // Basic IP validation regex
    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

    if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
      return ip;
    }
  } catch (e) {
    // Fallback on parser error
  }
  return '127.0.0.1';
}
