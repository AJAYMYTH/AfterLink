class AfterLinkError(Exception):
    PROTOCOL_ERROR = 1
    AUTH_REQUIRED = 2
    AUTH_FAILED = 3
    AUTH_EXPIRED = 4
    ROUTE_NOT_FOUND = 5
    VALIDATION_ERROR = 6
    RATE_LIMITED = 7
    CONNECTION_TIMEOUT = 8
    CONNECTION_CLOSED = 9
    INTERNAL_SERVER_ERROR = 10
    MALFORMED_PAYLOAD = 11
    UNKNOWN_FRAME_TYPE = 12
    DECOMPRESSION_FAILED = 13
    TLS_CERT_INVALID = 14
    FRAME_TOO_LARGE = 15
    COMPRESSION_ERROR = 16
    INVALID_FRAME = 17
    SERVER_CLOSING = 18
    PROTOCOL_VERSION_MISMATCH = 19

    ERROR_NAMES = {
        1: "PROTOCOL_ERROR",
        2: "AUTH_REQUIRED",
        3: "AUTH_FAILED",
        4: "AUTH_EXPIRED",
        5: "ROUTE_NOT_FOUND",
        6: "VALIDATION_ERROR",
        7: "RATE_LIMITED",
        8: "CONNECTION_TIMEOUT",
        9: "CONNECTION_CLOSED",
        10: "INTERNAL_SERVER_ERROR",
        11: "MALFORMED_PAYLOAD",
        12: "UNKNOWN_FRAME_TYPE",
        13: "DECOMPRESSION_FAILED",
        14: "TLS_CERT_INVALID",
        15: "FRAME_TOO_LARGE",
        16: "COMPRESSION_ERROR",
        17: "INVALID_FRAME",
        18: "SERVER_CLOSING",
        19: "PROTOCOL_VERSION_MISMATCH"
    }

    def __init__(self, code: int, message: str, details=None, retry_after: int = None, meta: dict = None):
        super().__init__(message)
        self.code = code
        self.name = self.ERROR_NAMES.get(code, "UNKNOWN")
        self.message = message
        self.details = details
        self.retry_after = retry_after
        self.meta = meta or {}

    def __str__(self):
        return f"{self.name} ({self.code}): {self.message}"

    def to_dict(self):
        res = {
            "code": self.code,
            "message": self.message
        }
        if self.details is not None:
            res["details"] = self.details
        if self.retry_after is not None:
            res["retry_after"] = self.retry_after
        if self.meta:
            res["meta"] = self.meta
        return res
