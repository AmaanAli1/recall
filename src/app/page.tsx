// The root route. For now, send everyone to the login page.
// Later this becomes a landing page, or redirects based on auth status
// (logged in -> dashboard, logged-out -> login).
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}