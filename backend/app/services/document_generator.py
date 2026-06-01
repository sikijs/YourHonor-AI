import re
from pathlib import Path
from typing import Optional

from app.db import get_db
from app.services.template_catalog import get_template_catalog
from app.services import template_catalog as tc

SPAN_PATTERN = re.compile(
    r'<span class="(coverpage_link|orderform_link|keyterms_link)">([^<]+)</span>'
)
LABEL_PATTERN = re.compile(r'</?label[^>]*>')
EXTRA_BLANK_PATTERN = re.compile(r'\n{3,}')


def _clean_html_tags(content: str) -> str:
    content = LABEL_PATTERN.sub('', content)
    content = EXTRA_BLANK_PATTERN.sub('\n\n', content)

    content = content.replace("| Print Name |", "| Print Name | |")
    content = content.replace(
        "Notice Address Use either email or postal address", "Notice Address"
    )
    
    signing_block = """


### PARTY 1

| Field | Signature |
|:--- |:--- |
| Signature | _________________ |
| Print Name | _________________ |
| Title | _________________ |
| Company | _________________ |
| Notice Address | ________________________________________ |
| Date | _________________ |


### PARTY 2

| Field | Signature |
|:--- |:--- |
| Signature | _________________ |
| Print Name | _________________ |
| Title | _________________ |
| Company | _________________ |
| Notice Address | ________________________________________ |
| Date | _________________ |
"""
    
    table_start = content.find("| PARTY 1 | PARTY 2 |")
    if table_start >= 0:
        while table_start > 0 and content[table_start - 1] != '\n':
            table_start -= 1
        table_end = content.find("\n\n", table_start)
        if table_end < 0:
            table_end = len(content)
        content = content[:table_start] + signing_block + content[table_end:]
    
    lines = content.split('\n')
    result = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            if result and result[-1] != '':
                result.append('')
            continue
        if stripped.startswith('### ') or stripped.startswith('**PARTY'):
            if result and result[-1] != '':
                result.append('')
            result.append('')
            result.append('')
            if stripped.startswith('**PARTY') or stripped == '### Party 1' or stripped == '### Party 2' or stripped == '### PARTY 1' or stripped == '### PARTY 2':
                result.append('')
                result.append('')
            result.append(line)
            result.append('')
        elif stripped.startswith('- [') or stripped.startswith('## '):
            result.append('')
            result.append(line)
        elif stripped.startswith('|'):
            if result and result[-1] == '' and result[-2] == '' if len(result) >= 2 else False:
                pass
            result.append(line)
        elif stripped.startswith('[') and stripped.endswith(']'):
            result.append(line)
            result.append('')
        else:
            result.append(line)
    return '\n'.join(result)
BRACKET_PATTERN = re.compile(r'\[([^\]]{3,})\]')


class DocumentGeneratorService:
    def __init__(self):
        self.catalog = get_template_catalog()

    def generate(
        self,
        template_name: str,
        field_values: dict[str, str],
        user_id: int,
        title: Optional[str] = None,
    ) -> dict:
        template = self.catalog.find_by_name(template_name)
        if not template:
            raise ValueError(f"Template '{template_name}' not found")

        template_path = tc.TEMPLATES_DIR / template.filename
        if not template_path.exists():
            raise ValueError(f"Template file not found: {template.filename}")

        content = template_path.read_text(encoding="utf-8")

        is_cover_page = "-coverpage" in template.filename or "-cover-page" in template.filename or "-cover_page" in template.filename
        if is_cover_page:
            filled = self._fill_cover_page(content, field_values)
        else:
            filled = self._fill_span_placeholders(content, field_values)
            cover_filename = self.catalog._cover_page_filename(template.filename)
            cover_path = tc.TEMPLATES_DIR / cover_filename
            if cover_path.exists():
                cover_content = cover_path.read_text(encoding="utf-8")
                cover_filled = self._fill_cover_page(cover_content, field_values)
                filled = cover_filled + "\n\n---\n\n" + filled

        doc_title = title or f"Generated: {template.name}"
        filled = _clean_html_tags(filled)

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO documents (user_id, title, content, doc_type) VALUES (?, ?, ?, ?)",
            (user_id, doc_title, filled, "generated_document"),
        )
        conn.commit()
        doc_id = cursor.lastrowid
        doc = cursor.execute(
            "SELECT id, title, content, doc_type FROM documents WHERE id = ?",
            (doc_id,),
        ).fetchone()
        conn.close()

        return {
            "id": doc["id"],
            "title": doc["title"],
            "content": doc["content"],
            "doc_type": doc["doc_type"],
        }

    def _fill_span_placeholders(self, content: str, field_values: dict[str, str]) -> str:
        def replacer(match: re.Match) -> str:
            field_name = match.group(2)
            return field_values.get(field_name, match.group(0))
        return SPAN_PATTERN.sub(replacer, content)

    def _fill_cover_page(self, content: str, field_values: dict[str, str]) -> str:
        result = self._fill_span_placeholders(content, field_values)

        if "Modifications" in field_values:
            mod_heading = "### MNDA Modifications"
            heading_pos = result.find(mod_heading)
            if heading_pos >= 0:
                after_heading = heading_pos + len(mod_heading)
                next_blank = result.find("\n\n", after_heading)
                if next_blank >= 0:
                    result = result[:after_heading] + "\n\n" + field_values["Modifications"] + result[next_blank:]

        field_heading_map = {
            "Governing Law": ["Governing Law & Jurisdiction", "Governing Law"],
            "Jurisdiction": ["Governing Law & Jurisdiction", "Jurisdiction"],
        }

        for field_name, value in field_values.items():
            headings = field_heading_map.get(field_name, [field_name])
            replaced = False
            for heading in headings:
                bracket_heading = f"### {heading}"
                heading_pos = result.find(bracket_heading)
                if heading_pos >= 0:
                    search_from = heading_pos + len(bracket_heading)
                    bracket_match = BRACKET_PATTERN.search(result, search_from)
                    if bracket_match:
                        result = result[:bracket_match.start()] + value + result[bracket_match.end():]
                        replaced = True
                        break
            if replaced:
                continue

            bracket_targets = [
                f"[{field_name}]",
            ]
            for target in bracket_targets:
                if target in result:
                    result = result.replace(target, value, 1)
                    break

        return result

    def get_fields_for_template(self, template_name: str) -> list[dict]:
        template = self.catalog.find_by_name(template_name)
        if not template:
            raise ValueError(f"Template '{template_name}' not found")

        fields = []
        for f in template.fields:
            fields.append({
                "name": f.name,
                "category": f.category,
                "required": True,
                "hint": f.hint or f"Enter value for '{f.name}'",
            })
        if template.cover_page_fields:
            for f in template.cover_page_fields:
                fields.append({
                    "name": f.name,
                    "category": "cover_page",
                    "required": True,
                    "hint": f.hint or f"Enter value for '{f.name}'",
                })
        return fields


document_generator = DocumentGeneratorService()


def get_document_generator() -> DocumentGeneratorService:
    return document_generator
