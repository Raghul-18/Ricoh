import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Phone, Mail, MessageSquare, FileText, CheckCircle, ArrowLeftRight, Edit, Trash2, ArrowRight } from 'lucide-react';
import { useProspect, useProspectActivities, useCreateActivity, useUpdateProspect, useDeleteProspect } from '../../hooks/useProspects';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';

const ACTIVITY_ICON = {
  call:         <Phone size={14} />,
  email:        <Mail size={14} />,
  note:         <MessageSquare size={14} />,
  quote:        <FileText size={14} />,
  created:      <CheckCircle size={14} />,
  stage_change: <ArrowLeftRight size={14} />,
};

const STAGE_OPTIONS = ['New lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const STAGE_META = {
  'New lead':    { label: 'New lead',    color: 'var(--tx3)' },
  'Qualified':   { label: 'Qualified',   color: 'var(--blue)' },
  'Proposal':    { label: 'Proposal',    color: 'var(--amber)' },
  'Negotiation': { label: 'Negotiation', color: 'var(--coral)' },
  'Won':         { label: 'Won',         color: 'var(--green)' },
  'Lost':        { label: 'Lost',        color: 'var(--red)' },
};

export default function P19ProspectProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast, confirm } = useAppContext();
  const { data: prospect, isLoading } = useProspect(id);
  const { data: activities = [] } = useProspectActivities(id);
  const createActivity = useCreateActivity(id);
  const updateProspect = useUpdateProspect(id);
  const deleteProspect = useDeleteProspect();

  const [newNote, setNewNote] = useState('');
  const [actType, setActType] = useState('note');
  const [editingStage, setEditingStage] = useState(false);

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;
  if (!prospect) return <div className="page"><div className="page-error">Prospect not found</div></div>;

  const stageMeta = STAGE_META[prospect.pipeline_stage] || STAGE_META['New lead'];

  const handleAddActivity = async () => {
    if (!newNote.trim()) return;
    try {
      await createActivity.mutateAsync({ type: actType, notes: newNote });
      setNewNote('');
      showToast('Activity logged', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleStageChange = async (stage) => {
    try {
      await updateProspect.mutateAsync({ pipeline_stage: stage });
      setEditingStage(false);
      showToast('Stage updated', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: 'Delete prospect', message: `Remove ${prospect.full_name} from your pipeline? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await deleteProspect.mutateAsync(id);
      showToast('Prospect deleted', 'success');
      navigate('/crm');
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate('/crm')}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <div className="page-title">{prospect.contact_name}</div>
            <div className="page-sub">{prospect.company_name || prospect.contact_email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => navigate(`/crm/${id}/convert`)}>
            <ArrowRight size={13} /> Convert to deal
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate(`/crm/${id}/edit`)}>
            <Edit size={13} /> Edit
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)', border: '1px solid var(--red-m)' }} onClick={handleDelete}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        {/* Left — activities */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Log activity</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {[['note','Note','MessageSquare'],['call','Call','Phone'],['email','Email','Mail']].map(([v,l]) => (
                <button key={v} className={`btn ${actType === v ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 11 }} onClick={() => setActType(v)}>
                  {ACTIVITY_ICON[v]} {l}
                </button>
              ))}
            </div>
            <textarea className="form-input" style={{ height: 80, fontSize: 12, resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }}
              placeholder={`Add a ${actType}…`} value={newNote} onChange={e => setNewNote(e.target.value)} />
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleAddActivity} disabled={!newNote.trim() || createActivity.isPending}>
              {createActivity.isPending ? <LoadingSpinner size={12} /> : <Plus size={13} />} Log {actType}
            </button>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16 }}>Activity timeline</div>
            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--tx4)', fontSize: 12 }}>No activity yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {activities.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', gap: 12, paddingBottom: i < activities.length - 1 ? 16 : 0, marginBottom: i < activities.length - 1 ? 0 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--coral-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral)' }}>
                        {ACTIVITY_ICON[a.activity_type] || <MessageSquare size={12} />}
                      </div>
                      {i < activities.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--bdr)', marginTop: 6 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: i < activities.length - 1 ? 16 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 12, textTransform: 'capitalize' }}>{a.activity_type}</span>
                        <span style={{ fontSize: 10, color: 'var(--tx4)' }}>
                          {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      {a.description && <div style={{ fontSize: 12, color: 'var(--tx3)', lineHeight: 1.5 }}>{a.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — details */}
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Pipeline stage
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setEditingStage(prev => !prev)}>Change</button>
            </div>
            {editingStage ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {STAGE_OPTIONS.map(s => (
                  <button key={s} className={`btn ${prospect.pipeline_stage === s ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 12, justifyContent: 'flex-start' }}
                    onClick={() => handleStageChange(s)}>
                    {STAGE_META[s].label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: stageMeta.color }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: stageMeta.color }}>{stageMeta.label}</span>
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Contact info</div>
            {[
              ['Name', prospect.contact_name],
              ['Company', prospect.company_name],
              ['Email', prospect.contact_email],
              ['Phone', prospect.contact_phone],
              ['Product interest', prospect.product_interest],
              ['Est. value', prospect.estimated_value ? `£${prospect.estimated_value.toLocaleString()}` : null],
              ['Created', new Date(prospect.created_at).toLocaleDateString('en-GB')],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 8, borderBottom: '1px solid var(--bdr)', marginBottom: 8 }}>
                <span style={{ color: 'var(--tx4)' }}>{k}</span>
                <span style={{ fontWeight: 500, color: 'var(--tx2)', maxWidth: 160, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            {prospect.notes && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--tx4)', marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.6 }}>{prospect.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
