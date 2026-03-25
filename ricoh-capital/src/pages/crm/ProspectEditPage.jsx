import { useParams, useNavigate } from 'react-router-dom';
import { useProspect } from '../../hooks/useProspects';
import ProspectForm from './ProspectForm';
import { LoadingSpinner } from '../../components/shared/FormField';

export default function ProspectEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: prospect, isLoading } = useProspect(id);

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;
  if (!prospect) return (
    <div className="page">
      <div className="page-error">Prospect not found.</div>
    </div>
  );

  return (
    <ProspectForm
      prospect={prospect}
      onSuccess={() => navigate(`/crm/${id}`)}
      onCancel={() => navigate(`/crm/${id}`)}
    />
  );
}
