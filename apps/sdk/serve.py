"""One foreground, non-daemon entrypoint for every Mari HTTP image."""
import json
import os
from pathlib import Path


def main():
    import uvicorn
    port = int(os.getenv('PORT', '8080'))
    if not 1 <= port <= 65535: raise ValueError('PORT must be between 1 and 65535')
    uvicorn.run(os.getenv('MARI_ENTRYPOINT', 'application.server:app'), host='0.0.0.0', port=port,
                workers=1, proxy_headers=False, timeout_graceful_shutdown=25)


if __name__ == '__main__': main()
