# Funkcjonalności i Architektura Projektu

W projekcie zrealizowano funkcjonalności związane z obsługą portfela inwestycyjnego jednego użytkownika w ramach założenia *proof of concept*. Aplikacja umożliwia przeglądanie, dodawanie, usuwanie oraz edycję aktywów (CRUD), które posiada użytkownik, w celu monitorowania stanu swojego portfela finansowego.  

Baza danych zawiera 20 instrumentów, po cztery z każdej z pięciu kategorii: **Akcje, Obligacje, Forex (Pary walutowe), Surowce** oraz **Kryptowaluty**. Poza predefiniowanymi podczas tworzenia bazy danych aktywami oraz klasami możliwe jest dodawanie nowych instrumentów do bazy danych.

---

## Dashboard

Pierwszą widoczną zakładką jest **Dashboard**, która zawiera informację o poprawnym połączeniu z bazą danych oraz wykres kołowy przedstawiający wkład procentowy poszczególnych klas aktywów do wartości całego portfela.

---

## Aktywa

Zakładka **Aktywa** renderuje tabelę, która zawiera przechowywane w bazie aktywa oraz przyciski umożliwiające:

- Obliczenie ryzyka na podstawie ostatnich 60 dni,  
- Obliczenie korelacji par aktywów na podstawie danych z ostatniego roku,  
- Dodanie nowego lub modyfikację istniejącego aktywa do bazy danych,  
- Usunięcie aktywa z bazy danych.  

Baza danych jest aktualizowana o te wartości.

---

## Portfel

Dostęp do swoich aktywów użytkownik otrzymuje po wejściu w zakładkę **Portfel**, gdzie renderowana jest tabela zawierająca posiadane instrumenty finansowe wraz z ich wartością w PLN oraz interaktywny, zwizualizowany w postaci grafu (zupełnego) portfel.  

- Węzły grafu są umieszczone na okręgu dla lepszej widoczności krawędzi łączących,  
- Węzłami grafu są odpowiednie aktywa, wartościami na krawędziach są korelacje pomiędzy odpowiednimi parami instrumentów,  
- Podawane jest również ważone ryzyko całego portfela (0 - brak ryzyka, 100 - wysokie ryzyko).  

Wszystkie tabele można sortować według każdej z kolumn.

---

## Baza Danych

Podstawowym założeniem projektu jest wykorzystanie grafowej bazy danych **Neo4J** [Neo4J](https://neo4j.com/), która jest zoptymalizowana pod kątem przechowywania i analizy powiązań między elementami. W tym celu wykorzystano usługę DBaaS dostępną w serwisie [Neo4J AuraDB](https://neo4j.com/cloud/aura/).

---

## Backend

Backend został napisany w frameworku **FastAPI** w **Pythonie**, umożliwiającym tworzenie szybkich REST API. Backend łączy się z bazą danych **Neo4J**, wykonując zapytania w języku **Cypher**, i jest hostowany na platformie **Render**.

Funkcjonalności backendu:

- Obliczanie korelacji na podstawie dziennych cen z ostatniego roku (z wykorzystaniem biblioteki `pandas`),  
- Codzienna aktualizacja cen aktywów oraz kursów walutowych w celu obliczenia wartości portfela (z użyciem `apscheduler`).

---

## Frontend

Frontend to aplikacja SPA napisana w **HTML**, **CSS** i **JavaScript**, z wykorzystaniem biblioteki **D3.js** do generowania interaktywnych wizualizacji grafu.  

- Cała logika działa po stronie klienta,  
- Komunikacja z backendem odbywa się przez plik `api.js`,  
- Pliki statyczne hostowane są na **GitHub Pages**.

---

## Uruchamianie lokalne

### Frontend

```bash
cd frontend
python -m http.server 8080
```
### Backend

```bash
cd backend
uvicorn main:app --reload
```


### requirements.txt

```bash
fastapi
uvicorn
neo4j
pydantic
python-dotenv
yfinance
apscheduler
pandas
numpy
```