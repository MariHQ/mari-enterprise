"""Native column projection formatting. Queries belong to each app."""
from .nodes import fields_for

def projection(label,alias='r',text=None):
    return ', '.join((text if n=='text' and text is not None else f'{alias}.`{n}`')+f' AS `{n}`' for n in fields_for(label))

def page_limit(value):
    if type(value) is not int or not 1<=value<=1001:raise ValueError('Invalid page size')
    return str(value)
