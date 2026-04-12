def build_import_mapping(source: str) -> dict:
    if source == "jira":
        return {
            "projects": "projects",
            "epics": "topics",
            "issues": "tickets",
            "comments": "documents_or_timeline",
        }

    return {
        "spaces": "spaces_or_root_folders",
        "pages": "documents",
    }
