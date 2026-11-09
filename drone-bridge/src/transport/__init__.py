"""
AERON Drone Bridge Transport Package
Handles secure M2M HTTP/HTTPS delivery to the unified backend.
"""
from .backend_client import BackendTransportClient

__all__ = ["BackendTransportClient"]

