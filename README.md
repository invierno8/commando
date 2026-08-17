# אמל״ח־נט — פרוטוטייפ מקומי

פרויקט Vite + React מינימלי שמריץ את שני הפרוטוטייפים באתר מקומי אמיתי,
עם live reload (כמו Live Server), כתובת מקומית ב-Chrome.

## הרצה (צריך Node.js מותקן — גרסה 18 ומעלה)

```bash
cd amalach-net
npm install
npm run dev
```

הטרמינל יראה כתובת כמו `http://localhost:5173` — פותחים אותה בכרום.
כל שינוי בקוד ישתקף בדפדפן מיידית, בלי לרענן ידנית.

## מבנה

- `src/BrigadeSetupWizard.jsx` — אשף התקנת חטיבה
- `src/TacticalSystem.jsx` — קטלוג אמל״ח + מערכת טיקטים
- `src/App.jsx` — מסך מעבר פשוט בין השניים (זמני, להדגמה בלבד)

## עצירה

`Ctrl+C` בטרמינל.
