import requests

API_KEY = "AIzaSyAPov7tLlj5QuKJELlJlftbpRlZk03fXJ8"

url = "https://generativelanguage.googleapis.com/v1beta/models"

headers = {
    "x-goog-api-key": API_KEY
}

response = requests.get(url, headers=headers)

print("Status Code:", response.status_code)
print("Response:")
print(response.text)
