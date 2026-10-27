import { Link } from "react-router-dom";
import { DishArt } from "./Art.tsx";
import { SyncChip } from "./SyncChip.tsx";
import { useApp } from "../state/store.tsx";

export function DinnerSummary() {
  const { state, menuDishes } = useApp();
  const ledgers = state.ledger.filter((entry) =>
    state.menuLedgerIds.includes(entry.id),
  );
  const count = menuDishes.length + ledgers.length;
  return (
    <aside className="dinner-summary" aria-label="今晚的晚餐">
      <div className="summary-head">
        <div>
          <p className="eyebrow">两个人的晚餐</p>
          <h2>{count ? `今晚已选 ${count} 道` : "今晚这一桌"}</h2>
        </div>
        <Link to="/tonight" className="see-all">
          {count ? "调整" : "去安排"} →
        </Link>
      </div>
      <img
        className="dinner-illustration"
        src={`${import.meta.env.BASE_URL}assets/v106/dinner-couple.png`}
        alt=""
        aria-hidden="true"
      />
      {count ? (
        <>
          <ul className="summary-list">
            {menuDishes.map((dish) => (
              <li key={dish.id}>
                <Link to={`/d/${encodeURIComponent(dish.id)}`}>
                  <DishArt name={dish.name} category={dish.category} />
                  <span>{dish.name}</span>
                </Link>
              </li>
            ))}
            {ledgers.map((entry) => (
              <li key={entry.id}>
                <Link to={`/ledger/${encodeURIComponent(entry.id)}`}>
                  <span>{entry.name}</span>
                  <small>我们的菜</small>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/list" className="btn-primary summary-cta">
            去采购这 {count} 道菜的食材 →
          </Link>
        </>
      ) : (
        <div className="summary-empty">
          <p>
            晚饭还没定，
            <br />
            给今天留一点好滋味。
          </p>
          <Link to="/browse" className="btn-secondary">
            挑几道喜欢的菜
          </Link>
        </div>
      )}
      <SyncChip compact />
    </aside>
  );
}
