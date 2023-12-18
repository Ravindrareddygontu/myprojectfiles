from translate import Translator

def translate_text(text, source_language='en', target_language='ja'):
    translator = Translator(from_lang=source_language, to_lang=target_language)
    translation = translator.translate(text)
    return translation


