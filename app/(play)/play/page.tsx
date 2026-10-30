import { redirect } from 'next/navigation'

/* The battle game is the VVM tab now; the old full-screen page sends you there. */
export default function PlayPage() {
  redirect('/vending')
}
