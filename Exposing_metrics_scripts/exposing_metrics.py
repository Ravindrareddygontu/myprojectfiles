from prometheus_client import start_http_server, Gauge
import time
import win32com.client
import pygetwindow
import getpass
from datetime import datetime

# Create a Gauge metric to track the number of users.
USERS_COUNT = Gauge('users_count', 'Number of users in the system')

# Create Gauge metrics to track active and previously used applications with labels.
ACTIVE_APPS = Gauge('active_apps', 'Count of active applications', ['name', 'user', 'time_opened'])
PREVIOUSLY_USED_APPS = Gauge('previously_used_apps', 'Count of previously used applications', ['name', 'user', 'time_closed'])

# Dictionary to maintain the state of open applications
open_apps_state = {}
previously_used_apps_state = {}

def get_users_count():
    wmi = win32com.client.GetObject('winmgmts:')
    users = wmi.ExecQuery('select * from Win32_UserAccount')
    return len(users)

def get_application_states():
    global open_apps_state, previously_used_apps_state
    
    open_windows = pygetwindow.getWindowsWithTitle('')
    app_names = [window.title for window in open_windows]
    current_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    current_apps_state = {}
    
    for app_name in app_names:
        user = getpass.getuser()
        
        if app_name in open_apps_state:
            time_opened = open_apps_state[app_name]['time_opened']
        else:
            time_opened = current_timestamp
        
        current_apps_state[app_name] = {'time_opened': time_opened, 'user': user}
        
        ACTIVE_APPS.labels(name=app_name, user=user, time_opened=time_opened).set(1.0)
    
    for app_name in open_apps_state.keys():
        if app_name not in current_apps_state:
            time_closed = current_timestamp
            user = open_apps_state[app_name]['user']
            PREVIOUSLY_USED_APPS.labels(name=app_name, user=user, time_closed=time_closed).set(1.0)
            previously_used_apps_state[app_name] = {'time_closed': time_closed, 'user': user}
    
    open_apps_state = current_apps_state

if __name__ == '__main__':
    start_http_server(8001)
    
    while True:
        users_count = get_users_count()
        USERS_COUNT.set(users_count)
        
        get_application_states()
        
        print('Listening...')
        
        time.sleep(5)  # Wait for 5 seconds before the next iteration