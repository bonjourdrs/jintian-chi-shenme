import { lazy, Suspense } from "react";
import { CoupleProvider } from "./state/couple.tsx";
import { HashRouter, Route, Routes } from "react-router-dom";
import { CatalogGate } from "./components/CatalogGate.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Shell } from "./components/Shell.tsx";
const DishListPage = lazy(async () => ({
  default: (await import("./pages/DishListPage.tsx")).DishListPage,
}));
const DishPage = lazy(async () => ({
  default: (await import("./pages/DishPage.tsx")).DishPage,
}));
const HomePage = lazy(async () => ({
  default: (await import("./pages/HomePage.tsx")).HomePage,
}));
const LedgerEditPage = lazy(async () => ({
  default: (await import("./pages/LedgerEditPage.tsx")).LedgerEditPage,
}));
const LedgerPage = lazy(async () => ({
  default: (await import("./pages/LedgerPage.tsx")).LedgerPage,
}));
import { NotFound } from "./pages/NotFound.tsx";
const ShoppingPage = lazy(async () => ({
  default: (await import("./pages/ShoppingPage.tsx")).ShoppingPage,
}));
const TonightPage = lazy(async () => ({
  default: (await import("./pages/TonightPage.tsx")).TonightPage,
}));
const UsPage = lazy(async () => ({
  default: (await import("./pages/UsPage.tsx")).UsPage,
}));
import { AppProvider } from "./state/store.tsx";

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <CoupleProvider>
          <Shell>
            <ErrorBoundary>
              <CatalogGate>
                <Suspense
                  fallback={
                    <div className="page route-loading" role="status">
                      正在准备页面…
                    </div>
                  }
                >
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/browse" element={<DishListPage />} />
                    <Route path="/c/:category" element={<DishListPage />} />
                    <Route path="/d/:id" element={<DishPage />} />
                    <Route path="/tonight" element={<TonightPage />} />
                    <Route path="/list" element={<ShoppingPage />} />
                    <Route path="/ledger" element={<LedgerPage />} />
                    <Route
                      path="/ledger/new"
                      element={<LedgerEditPage creating />}
                    />
                    <Route path="/ledger/:id" element={<LedgerEditPage />} />
                    <Route path="/us" element={<UsPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </CatalogGate>
            </ErrorBoundary>
          </Shell>
        </CoupleProvider>
      </AppProvider>
    </HashRouter>
  );
}
