import concurrent.futures

_executor = None

def get_executor() -> concurrent.futures.ProcessPoolExecutor:
    """Lazily initialize and return a shared ProcessPoolExecutor."""
    global _executor
    if _executor is None:
        # Use 2 workers to avoid CPU/RAM overhead on lightweight instances
        _executor = concurrent.futures.ProcessPoolExecutor(max_workers=2)
    return _executor

def shutdown_executor():
    """Shut down the ProcessPoolExecutor cleanly."""
    global _executor
    if _executor is not None:
        _executor.shutdown(wait=False)
        _executor = None
