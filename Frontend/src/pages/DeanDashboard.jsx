import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function DeanDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'majors', 'heads'
  const [majors, setMajors] = useState([]);
  const [heads, setHeads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Forms state
  const [newMajorName, setNewMajorName] = useState('');
  const [newHead, setNewHead] = useState({
    full_name: '', email: '', national_id: '', major_id: ''
  });

  

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [majorsRes, headsRes] = await Promise.all([
        client.get('/dean/majors'),
        client.get('/dean/heads')
      ]);
      setMajors(majorsRes.data);
      setHeads(headsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addMajor = async (e) => {
    e.preventDefault();
    try {
      await client.post('/dean/majors', { name: newMajorName });
      setNewMajorName('');
      loadData(); // Refresh
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add major');
    }
  };

const inviteHead = async (e) => {
  e.preventDefault();
  try {
    await client.post('/invitations', {
      full_name: newHead.full_name,
      email: newHead.email,
      national_id: newHead.national_id,
      role: 'head',
      major_id: parseInt(newHead.major_id) // ⚠️ أهم سطر: بنحولها لرقم
    });
    alert('Invitation sent successfully!');
    setNewHead({ full_name: '', email: '', national_id: '', major_id: '' });
    loadData();
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to send invitation');
  }
};

  const updateHead = async (id, full_name, email, major_id) => {
  try {
    await client.put(`/dean/heads/${id}`, {
      full_name,
      email,
      major_id: major_id ? parseInt(major_id) : null
    });
    alert('Head updated successfully');
    loadData(); // Refresh list
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to update head');
  }
};

  const deleteMajor = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await client.delete(`/dean/majors/${id}`);
      loadData();
    } catch (err) {
      alert('Failed to delete major');
    }
  };

  const updateMajor = async (id, name) => {
  try {
    await client.put(`/dean/majors/${id}`, { name });
    alert('Major updated successfully');
    loadData(); // Refresh
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to update major');
  }
};

  const deleteHead = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await client.delete(`/dean/heads/${id}`);
      loadData();
    } catch (err) {
      alert('Failed to delete head');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <header style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Dean Dashboard</h1>
        <button onClick={logout}>Logout</button>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('overview')} style={{ fontWeight: activeTab === 'overview' ? 'bold' : 'normal' }}>Overview</button>
        <button onClick={() => setActiveTab('majors')} style={{ fontWeight: activeTab === 'majors' ? 'bold' : 'normal' }}>Majors</button>
        <button onClick={() => setActiveTab('heads')} style={{ fontWeight: activeTab === 'heads' ? 'bold' : 'normal' }}>Heads</button>
      </div>

      {/* TAB: Overview */}
      {activeTab === 'overview' && (
        <section>
          <h2>System Overview</h2>
          <p>Majors: {majors.length}</p>
          <p>Heads: {heads.length}</p>
          {/* ممكن نضيف إحصائيات تانية هنا */}
        </section>
      )}

      {/* TAB: Majors */}
      {activeTab === 'majors' && (
        <section>
          <h2>Add Major</h2>
          <form onSubmit={addMajor} style={{ marginBottom: '20px' }}>
            <input 
              placeholder="Major Name (e.g. Computer Science)" 
              value={newMajorName} 
              onChange={e => setNewMajorName(e.target.value)} 
              required 
            />
            <button type="submit">Add</button>
          </form>

          <h2>Majors List ({majors.length})</h2>
          <table border="1" cellPadding="5">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Head</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {majors.map(m => (
                <tr key={m.id}>
                  <td>{m.id}</td>
                  <td>{m.name}</td>
                  <td>{m.head_name || 'None'}</td>
<td>
  <button onClick={() => {
    const newName = prompt('Enter new name:', m.name);
    if (newName) updateMajor(m.id, newName);
  }}>Edit</button>
  <button onClick={() => deleteMajor(m.id)} style={{ color: 'red', marginLeft: '10px' }}>Delete</button>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* TAB: Heads */}
      {activeTab === 'heads' && (
        <section>
          <h2>Invite Head of Department</h2>
          <form onSubmit={inviteHead} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
            <input 
              placeholder="Full Name" 
              value={newHead.full_name} 
              onChange={e => setNewHead({...newHead, full_name: e.target.value})} 
              required 
            />
            <input 
              type="email"
              placeholder="Email" 
              value={newHead.email} 
              onChange={e => setNewHead({...newHead, email: e.target.value})} 
              required 
            />
            <input 
              placeholder="National ID (14 digits)" 
              value={newHead.national_id} 
              onChange={e => setNewHead({...newHead, national_id: e.target.value})} 
              required 
            />
            <select 
              value={newHead.major_id} 
              onChange={e => setNewHead({...newHead, major_id: e.target.value})} 
              required
            >
              <option value="">-- Select Major --</option>
              {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button type="submit">Send Invitation</button>
          </form>

          <h2>Heads List ({heads.length})</h2>
          <table border="1" cellPadding="5">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Major</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {heads.map(h => (
                <tr key={h.id}>
                  <td>{h.id}</td>
                  <td>{h.full_name}</td>
                  <td>{h.email}</td>
                  <td>{h.major_name || 'None'}</td>
<td>
  <button onClick={() => {
    const newName = prompt('Enter new name:', h.full_name);
    const newEmail = prompt('Enter new email:', h.email);
    const newMajorId = prompt('Enter Major ID:', h.major_id || '');
    
    if (newName && newEmail) {
      updateHead(h.id, newName, newEmail, newMajorId);
    }
  }}>Edit</button>
  
  <button onClick={() => deleteHead(h.id)} style={{ color: 'red', marginLeft: '10px' }}>Delete</button>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}