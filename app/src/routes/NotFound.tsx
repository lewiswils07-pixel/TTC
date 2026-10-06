import { Link } from 'react-router'
import { Layout } from '../components/Layout'

export function NotFound() {
  return (
    <Layout>
      <h1>Page not found</h1>
      <p>We couldn’t find that page.</p>
      <Link className="btn btn-primary" to="/">
        Go to the home page
      </Link>
    </Layout>
  )
}
