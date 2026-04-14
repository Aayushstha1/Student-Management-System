import re


def normalize_class_section(class_name, section=None):
    class_value = str(class_name or '').strip()
    section_value = str(section or '').strip()

    if not class_value:
        return '', section_value.upper() if section_value else ''

    class_value = re.sub(r'(?i)\bclass\b', '', class_value).strip()
    class_value = re.sub(r'[-_/]+', ' ', class_value)
    class_value = re.sub(r'\s+', ' ', class_value).strip()

    match = re.match(r'^(\d+)\s*([A-Za-z])$', class_value)
    if match and (not section_value or section_value.upper() == match.group(2).upper()):
        class_value = match.group(1)
        section_value = section_value or match.group(2)
    else:
        match = re.match(r'^(\d+)\s+([A-Za-z]+)$', class_value)
        if match and (not section_value or section_value.upper() == match.group(2).upper()):
            class_value = match.group(1)
            section_value = section_value or match.group(2)
        else:
            match = re.match(r'^(\d+)([A-Za-z]+)$', class_value)
            if match and (not section_value or section_value.upper() == match.group(2).upper()):
                class_value = match.group(1)
                section_value = section_value or match.group(2)
            else:
                if not section_value:
                    parts = class_value.split(' ')
                    if len(parts) >= 2 and parts[0].isdigit():
                        class_value = parts[0]
                        section_value = parts[1]

    return class_value, section_value.upper() if section_value else ''
