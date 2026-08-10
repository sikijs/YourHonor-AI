from pydantic import BaseModel, Field


class DoctrineCaseNode(BaseModel):
    """A landmark case appearing under a doctrine.

    name/year/citation must mirror the corresponding LANDMARK_CASES entry —
    a regression test in tests/test_doctrine.py enforces the parity.
    """

    name: str
    citation: str
    year: int
    holding: str


class Doctrine(BaseModel):
    """A curated legal doctrine with its landmark cases."""

    id: str = Field(..., description="Stable slug used as a key (e.g. judicial-review)")
    name: str
    subject: str
    description: str
    cases: list[DoctrineCaseNode]


class DoctrineMapResponse(BaseModel):
    version: int
    updated: str
    doctrines: list[Doctrine]
