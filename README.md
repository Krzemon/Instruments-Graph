🔍 Gdzie umieścić skrypt Cypher?
Skrypt inicjalizujący dane:
nie trzymasz go w kodzie backendu
trzymasz jako plik:
database_init.cypher — i uruchamiasz ręcznie w Neo4j Browser
Przykład:
:source database_init.cypher

Nie ma sensu ładować danych przez FastAPI, bo to jednorazowe.



2) Czy warto dodać drugą chmurę (AWS, Azure, Heroku, IBM Cloud)?

Nie jest to potrzebne, ale może przynieść +10 punktów za „ciekawe rozwiązanie technologiczne”, jeśli faktycznie coś dodasz, co ma wartość.
Co dodatkowa chmura mogłaby robić (opcjonalnie)?
A. Hosting backendu FastAPI
Możesz umieścić FastAPI na:
Render,
Railway,
Deta Space,
Heroku (free limited)
AWS / Azure / GCP (trudniejsze)
Wtedy cały projekt działa w chmurze end-to-end:
Neo4j w AuraDB,
Backend w chmurze,
Frontend na Netlify/Vercel.
➡️ To jest najbardziej sensowne i najprostsze rozszerzenie.


B. Hosting frontendu (Vercel / Netlify)
To także jest chmura.
Jeśli to zrobisz → dostajesz dodatkowy punkt „za wykorzystanie środowiska chmurowego”.

C. Funkcje serverless (AWS Lambda / Azure Functions)
Można użyć do:
okresowej aktualizacji danych,
pobierania live-danych rynkowych (np. co godzinę),
automatycznego przebudowania korelacji.
➡️ To byłoby „ciekawe rozwiązanie”, ale nie jest wymagane.

3) Czy GraphQL ma tu sens?
Tak — jeśli chcesz zdobyć dodatkowe 10 punktów.
I uzasadnienie byłoby bardzo logiczne, bo:
GraphQL świetnie pasuje do danych grafowych,
Neo4j ma natywną integrację z GraphQL (Neo4j GraphQL Library),
możesz wystawić API typu:

{
  assets {
    name
    type
    correlations {
      value
      target {
        name
      }
    }
  }
}


Co zyskujesz?
frontend pobiera dokładnie te dane, które potrzebuje,
GraphQL idealnie pokazuje powiązania (nodes/edges),
w dokumentacji to wygląda bardzo profesjonalnie.
➡️ Dodanie GraphQL daje wysoki „technologiczny +10 pkt”, ale nie jest obowiązkowe.