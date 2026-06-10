"""Entry point: `python -m retrieval_sidecar`."""

import sys

from .server import main

if __name__ == "__main__":
    sys.exit(main())
