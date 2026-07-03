from pydantic import BaseModel, ValidationError
from .errors import AfterLinkError

def validate_with_pydantic(model_class, data):
    """
    Validates dictionary data against a Pydantic model class.
    Raises AfterLinkError with VALIDATION_ERROR code on failure.
    """
    if not issubclass(model_class, BaseModel):
        raise TypeError("model_class must be a subclass of pydantic.BaseModel")
    try:
        return model_class.model_validate(data)
    except ValidationError as err:
        details = {e["loc"][0]: e["msg"] for e in err.errors() if e["loc"]}
        raise AfterLinkError(
            code=AfterLinkError.VALIDATION_ERROR,
            message="Validation failed",
            details=details
        )
