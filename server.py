#!/usr/bin/env python3
"""
Simple HTTP Server for Wisher Development

This script starts a local development server for the Wisher application.
It serves static files and handles CORS for Firebase integration.

Usage:
    python server.py [port]
    
Default port is 7050.
"""

import http.server
import socketserver
import sys
import os
from urllib.parse import urlparse, unquote
import urllib.request

# Global counter for request logs
request_log_counter = 0

# Global variable to store header lines
HEADER_LINES = []

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP Request Handler with CORS support and proxy endpoint"""
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle preflight OPTIONS requests"""
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests, including proxy endpoint"""
        # Check if this is a proxy request
        if self.path.startswith('/api/proxy?url='):
            self.handle_proxy_request()
        else:
            # Normal file serving
            super().do_GET()
    
    def handle_proxy_request(self):
        """Proxy requests to external URLs to bypass CORS"""
        try:
            # Extract the URL parameter
            url_param = self.path.split('url=', 1)[1] if 'url=' in self.path else None
            if not url_param:
                self.send_error(400, 'Missing URL parameter')
                return
            
            target_url = unquote(url_param)
            
            # Create request with proper headers
            req = urllib.request.Request(
                target_url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            )
            
            # Fetch the content
            with urllib.request.urlopen(req, timeout=15) as response:
                content = response.read()
                
                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', len(content))
                self.end_headers()
                self.wfile.write(content)
                
        except Exception as e:
            self.send_error(500, f'Proxy error: {str(e)}')
    
    def guess_type(self, path):
        """Guess the type of a file based on its URL."""
        guessed_type = super().guess_type(path)
        if isinstance(guessed_type, tuple):
            mimetype, encoding = guessed_type
        else:
            mimetype = guessed_type
            encoding = None
        
        # Ensure proper MIME types for web files
        if path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.css'):
            return 'text/css'
        elif path.endswith('.html'):
            return 'text/html'
        elif path.endswith('.json'):
            return 'application/json'
        
        return mimetype
    
    def log_message(self, format, *args):
        """Custom log format with periodic screen clear and header reprint"""
        global request_log_counter
        global HEADER_LINES

        request_log_counter += 1

        if request_log_counter % 20 == 0:
            os.system('cls' if os.name == 'nt' else 'clear')
            for line in HEADER_LINES:
                print(line)
            print("\n" + "-"*50 + "\n") # Add a separator

        print(f"[{self.log_date_time_string()}] {format % args}")

def is_port_in_use(port, host="127.0.0.1"):
    """Return True if a TCP connection to host:port succeeds (port is in use)"""
    import socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex((host, port)) == 0
    except Exception:
        return False

def main():
    # Get port from command line argument or use default
    port = 7050
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port number: {sys.argv[1]}")
            print("Using default port 7050")
    
    # Abort if port already in use
    if is_port_in_use(port):
        print(f"Error: Port {port} is already in use. Another server appears to be running.", file=sys.stderr)
        sys.exit(1)
    
    # Change to the public directory to serve static files
    script_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(script_dir, 'public')
    os.chdir(public_dir)
    
    # Store header lines globally
    global HEADER_LINES
    HEADER_LINES = [
        f"\n🎁 Wisher Development Server",
        f"📁 Serving files from: {script_dir}",
        f"🌐 Server running at: http://localhost:{port}",
        f"📱 Mobile access: http://{get_local_ip()}:{port}",
        f"\n🔧 Make sure to configure Firebase settings in firebase-config.js",
        f"🔗 Proxy endpoint enabled: /api/proxy?url=<URL>",
        f"⚡ Press Ctrl+C to stop the server\n"
    ]

    # Print initial header
    for line in HEADER_LINES:
        try:
            print(line)
        except UnicodeEncodeError:
            # Fallback for systems that don't support Unicode
            print(line.encode('ascii', 'ignore').decode('ascii'))
    print("\n" + "-"*50 + "\n") # Add a separator
    
    # Create server
    with socketserver.TCPServer(("", port), CORSHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped. Thanks for using Wisher!")
        except Exception as e:
            print(f"\n\n❌ Server crashed unexpectedly: {e}")
            import traceback
            traceback.print_exc()
        finally:
            httpd.server_close()
            print("Server closed.")

def get_local_ip():
    """Get the local IP address for mobile testing"""
    import socket
    try:
        # Connect to a remote address to determine local IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "localhost"

if __name__ == "__main__":
    main()