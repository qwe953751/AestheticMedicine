import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { clearCloudMemory, cloud } from "./cloud";
export function useAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    let live = true;
    cloud.auth
      .getSession()
      .then(({ data }) => {
        if (live) {
          setUser(data.session?.user || null);
          setResolved(true);
        }
      })
      .catch(() => {
        if (live) {
          setUser(null);
          setResolved(true);
        }
      });
    const {
      data: { subscription },
    } = cloud.auth.onAuthStateChange((_event, session) => {
      if (live) {
        setUser(session?.user || null);
        setResolved(true);
        if (!session) clearCloudMemory();
      }
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  return { user, resolved };
}
export default function CloudAccount({
  user,
  busy,
  onRefresh,
  onMigrate,
}: {
  user: User | null;
  busy: boolean;
  onRefresh: () => void;
  onMigrate: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(action: "login" | "register") {
    setWaiting(true);
    setMessage("");
    try {
      const { data, error } =
        action === "login"
          ? await cloud.auth.signInWithPassword({ email, password })
          : await cloud.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: "https://frank-aestheticmedicine.github.io/",
              },
            });
      if (error) throw error;
      if (!data.session)
        setMessage(
          "請開啟驗證郵件確認信箱，再回到網站登入。若未收到，請查看垃圾郵件或稍後重試。",
        );
      setPassword("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setWaiting(false);
    }
  }
  return (
    <section className="panel settings-panel cloud-account">
      <h3>登入與跨裝置同步</h3>
      {user ? (
        <>
          <p>
            目前帳號：{user.email}
            <br />
            紀錄與附件儲存在私人雲端空間。同帳號登入手機、電腦即可讀取；開啟頁面或回到前景時自動檢查更新。
          </p>
          <div className="cloud-actions">
            <button
              className="button secondary"
              disabled={busy || waiting}
              onClick={onRefresh}
            >
              重新載入雲端
            </button>
            <button
              className="button secondary"
              disabled={busy || waiting}
              onClick={async () => {
                setWaiting(true);
                try {
                  await onMigrate();
                  setMessage("本機資料已加入雲端。");
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setWaiting(false);
                }
              }}
            >
              將此瀏覽器舊資料加入雲端
            </button>
            <button
              className="text-button"
              disabled={busy || waiting}
              onClick={async () => {
                setWaiting(true);
                const { error } = await cloud.auth.signOut();
                setWaiting(false);
                if (error) setMessage(error.message);
              }}
            >
              登出
            </button>
          </div>
          <p className="small-text">
            匯入舊資料時，若同一筆 ID
            的內容與雲端不同，會停止並請你先匯出備份；不會靜默覆蓋。
          </p>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit("login");
          }}
        >
          <p>
            登入後才會上傳雲端；未登入的紀錄仍僅存在此瀏覽器。新帳號請先註冊並完成信箱驗證。目前內建寄信服務僅支援專案管理者信箱；其他信箱需先設定寄信服務。
          </p>
          <label className="field">
            <span>電子郵件</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>密碼（至少 12 字元）</span>
            <input
              type="password"
              autoComplete="current-password"
              minLength={12}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="cloud-actions">
            <button className="button primary" disabled={waiting || busy}>
              {waiting ? "處理中…" : "登入"}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={waiting || busy || !email || password.length < 12}
              onClick={() => submit("register")}
            >
              建立帳號
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
