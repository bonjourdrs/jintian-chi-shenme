import { HashRouter, Route, Routes } from "react-router-dom";
import { CatalogGate } from "./components/CatalogGate.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Shell } from "./components/Shell.tsx";
import { DishListPage } from "./pages/DishListPage.tsx";
import { DishPage } from "./pages/DishPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { LedgerEditPage } from "./pages/LedgerEditPage.tsx";
import { LedgerPage } from "./pages/LedgerPage.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { ShoppingPage } from "./pages/ShoppingPage.tsx";
import { TonightPage } from "./pages/TonightPage.tsx";
import { UsPage } from "./pages/UsPage.tsx";
import { AppProvider } from "./state/store.tsx";

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <Shell>
          <ErrorBoundary>
            <CatalogGate>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/browse" element={<DishListPage />} />
                <Route path="/c/:category" element={<DishListPage />} />
                <Route path="/d/:id" element={<DishPage />} />
                <Route path="/tonight" element={<TonightPage />} />
                <Route path="/list" element={<ShoppingPage />} />
                <Route path="/ledger" element={<LedgerPage />} />
                <Route path="/ledger/new" element={<LedgerEditPage creating />} />
                <Route path="/ledger/:id" element={<LedgerEditPage />} />
                <Route path="/us" element={<UsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CatalogGate>
          </ErrorBoundary>
        </Shell>
      </AppProvider>
    </HashRouter>
  );
}
