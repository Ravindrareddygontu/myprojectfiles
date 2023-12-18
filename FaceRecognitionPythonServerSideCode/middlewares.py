from fastapi import Request
from token_validation import check_and_update_token
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.concurrency import iterate_in_threadpool
from lang_translate import translate_text
import json

SOURCE_LANGUAGE = 'en'
DESTINATION_LANGUAGE = 'ja'

class TokenMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        # result = check_and_update_token(request)
        # if result == 400:
        #     raise HTTPException(status_code=400, detail='Session has expired')
        return await call_next(request)

#internationlizing the messages
class I18nMiddleware(BaseHTTPMiddleware):
    WHITE_LIST = ['en-US', 'ja-JP', 'zh-TW']

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        accepted_languages = request.headers.get('accept-language', None).split(',')
        locale = ''
        for language in accepted_languages:
            if language in self.WHITE_LIST:
                locale = language
        if not locale:
            locale = 'en-US'
        request.state.locale = locale
        response = await call_next(request)

        if locale == 'ja-JP':
            #response.body_iterator is a iterator object which consists of data we are sending
            #it converts byte stream to str(chunk)
            response_body = [chunk async for chunk in response.body_iterator]
            #it converts str to dict
            dic = json.loads(response_body[0].decode())
            translated_dict = {}
            for key, value in dic.items():
                    translated_key = translate_text(key, SOURCE_LANGUAGE, DESTINATION_LANGUAGE)
                    translated_value = translate_text(value, SOURCE_LANGUAGE, DESTINATION_LANGUAGE)
                    translated_dict[translated_key] = translated_value
                    print(translated_key,translated_value)
            translated_json = json.dumps(translated_dict)
            response_body[0] = translated_json.encode()
            response.headers['content-length'] = str(len(response_body[0]))
            response.body_iterator = iterate_in_threadpool(iter(response_body))
        return response