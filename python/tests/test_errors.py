from afterlink import AfterLinkError

def test_error_instantiation():
    err = AfterLinkError(AfterLinkError.ROUTE_NOT_FOUND, "Route not found", details="some-detail", retry_after=5)
    assert err.code == 5
    assert err.name == "ROUTE_NOT_FOUND"
    assert err.message == "Route not found"
    assert err.details == "some-detail"
    assert err.retry_after == 5
    assert str(err) == "ROUTE_NOT_FOUND (5): Route not found"

def test_error_to_dict():
    err = AfterLinkError(AfterLinkError.AUTH_FAILED, "Auth failed")
    d = err.to_dict()
    assert d["code"] == 3
    assert d["message"] == "Auth failed"
    assert "details" not in d
