import logging
import sys
from .config import config

def setup_logging(name: str = "AERON-BRIDGE") -> logging.Logger:
    """Configures structured logger matching project conventions."""
    logger = logging.getLogger(name)
    level = getattr(logging, config.log_level, logging.INFO)
    logger.setLevel(level)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger

