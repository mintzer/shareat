import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { TouchBackend } from 'react-dnd-touch-backend';
import './App.css';

document.title = 'ShareEat'
// OG image
const ogImage = document.createElement('meta')
ogImage.setAttribute('property', 'og:image')
ogImage.content = 'https://gitlab.com/shay9844/shareat/-/raw/main/public/logo2.webp'
document.head.appendChild(ogImage)
// OG title
const ogTitle = document.createElement('meta')
ogTitle.setAttribute('property', 'og:title')
ogTitle.content = 'ShareEat'
document.head.appendChild(ogTitle)
// OG description
const ogDescription = document.createElement('meta')
ogDescription.setAttribute('property', 'og:description')
ogDescription.content = 'ShareEat is a simple app to split the bill between friends'
document.head.appendChild(ogDescription)

// <meta name="viewport" content="width=device-width, initial-scale=1.0">
const viewport = document.createElement('meta')
viewport.setAttribute('name', 'viewport')
viewport.content = 'width=device-width, initial-scale=1.0'
document.head.appendChild(viewport)

const ItemTypes = {
    PERSON: 'person',
};

function Person({ name, id, avatar }) {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.PERSON,
        item: { id },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }));

    return (
        <div ref={drag} className="person" style={{ opacity: isDragging ? 0.5 : 1 }}>
            <img src={avatar} alt={name} className="avatar" />
            {name}
        </div>
    );
}

Person.propTypes = {
    name: PropTypes.string.isRequired,
    id: PropTypes.number.isRequired,
    avatar: PropTypes.string.isRequired,
};

function Dish({ name, id, icon, price, people, onDrop, onRemove, onAddAll, onRemoveAll }) {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: ItemTypes.PERSON,
        drop: (item) => onDrop(item.id, id),
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }));

    return (
        <div ref={drop} className="dish" style={{ backgroundColor: isOver ? 'lightgreen' : 'white' }}>
            <img src={icon} alt={name} className="dish-icon" />
            <div>{name}</div>
            <div className="dish-price">₪{price.toFixed(0)}</div>
            <div className="dish-buttons">
                <button onClick={() => onRemoveAll(id)}>Restart</button>
                <button onClick={() => onAddAll(id)}>Everyone</button>
            </div>
            <div className="dish-people">
                {people.map((person) => (
                    <div key={person.id} className="avatar-small-container">
                        <img src={person.avatar} alt={person.name} className="avatar-small" />
                        <button className={"remove-people-button"} onClick={() => onRemove(person.id, id)}>Remove</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

Dish.propTypes = {
    name: PropTypes.string.isRequired,
    id: PropTypes.number.isRequired,
    icon: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    people: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            name: PropTypes.string.isRequired,
            avatar: PropTypes.string.isRequired,
        })
    ).isRequired,
    onDrop: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    onAddAll: PropTypes.func.isRequired,
    onRemoveAll: PropTypes.func.isRequired,
};

function App() {
    const [people] = useState([
        { id: 1, name: 'Shay', avatar: 'avatar2.jpg' },
        { id: 2, name: 'Eitan', avatar: 'avatar1.avif' },
        { id: 3, name: 'Mika', avatar: 'avatar3.png' },
    ]);
    const [dishes, setDishes] = useState([
        { id: 1, name: 'Pizza', icon: 'pizza.png', price: 58.90, people: [] },
        { id: 2, name: 'Pasta', icon: 'pasta.webp', price: 61.90, people: [] },
    ]);
    const [bill, setBill] = useState(null);
    const [total, setTotal] = useState(0);
    const [tipPercentage, setTipPercentage] = useState(12);
    const [totalWithTip, setTotalWithTip] = useState(null);
    const [isBillCalculated, setIsBillCalculated] = useState(false);
    const resultsRef = useRef(null);

    useEffect(() => {
        calculateBill();
    }, [dishes, tipPercentage]);

    const handleDrop = (personId, dishId) => {
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.id === dishId && !dish.people.some((p) => p.id === personId)
                    ? { ...dish, people: [...dish.people, people.find((p) => p.id === personId)] }
                    : dish
            )
        );
    };

    const handleRemove = (personId, dishId) => {
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.id === dishId
                    ? { ...dish, people: dish.people.filter((p) => p.id !== personId) }
                    : dish
            )
        );
    };

    const handleAddAll = (dishId) => {
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.id === dishId ? { ...dish, people: people } : dish
            )
        );
    };

    const handleRemoveAll = (dishId) => {
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.id === dishId ? { ...dish, people: [] } : dish
            )
        );
    };

    const calculateBill = () => {
        const bill = people.reduce((acc, person) => {
            const total = dishes.reduce((sum, dish) => {
                const personCount = dish.people.length;
                if (personCount > 0 && dish.people.some((p) => p.id === person.id)) {
                    return sum + dish.price / personCount;
                }
                return sum;
            }, 0);
            return { ...acc, [person.name]: total };
        }, {});

        const totalAmount = Object.values(bill).reduce((sum, amount) => sum + amount, 0);
        const unselectedDishesTotal = dishes.reduce((sum, dish) => {
            return dish.people.length === 0 ? sum + dish.price : sum;
        }, 0);

        if (unselectedDishesTotal > 0) {
            const equalShare = unselectedDishesTotal / people.length;
            people.forEach((person) => {
                bill[person.name] += equalShare;
            });
        }

        setBill(bill);
        setTotal(totalAmount + unselectedDishesTotal);
        calculateTip(tipPercentage, bill);
    };

    const calculateTip = (percentage, bill) => {
        setTipPercentage(percentage);
        const totalWithTip = Object.entries(bill).reduce((acc, [name, amount]) => {
            const tipAmount = amount * (percentage / 100);
            return { ...acc, [name]: (amount + tipAmount).toFixed(0) };
        }, {});
        setTotalWithTip(totalWithTip);
    };

    const handleCalculateBill = () => {
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.people.length === 0 ? { ...dish, people: people } : dish
            )
        );
        calculateBill();
        setIsBillCalculated(true);
        setTimeout(() => {
            resultsRef.current.scrollIntoView({ behavior: 'smooth' });
        }, 0);
    };

    const getAvatar = (name) => {
        const person = people.find((p) => p.name === name);
        return person ? person.avatar : '';
    };
    const getAllAvatars = () => {
        return people.map((person) => (
            <img key={person.id} src={person.avatar} alt={person.name} className="avatar-small stacked-avatar" />
        ));
    };

    return (
        <DndProvider backend={TouchBackend} options={{ enableMouseEvents: true }}>
            <div className="app">
                <img src="logo2.webp" alt="logo" className="logo" />
                <h2>Drag people to dishes they had</h2>
                <div className="people">
                    {people.map((person) => (
                        <Person key={person.id} id={person.id} name={person.name} avatar={person.avatar} />
                    ))}
                </div>
                <div className="dishes">
                    {dishes.map((dish) => (
                        <Dish key={dish.id} id={dish.id} name={dish.name} icon={dish.icon} price={dish.price} people={dish.people} onDrop={handleDrop} onRemove={handleRemove} onAddAll={handleAddAll} onRemoveAll={handleRemoveAll} />
                    ))}
                </div>
                <button className="calculate-button" onClick={handleCalculateBill}>Calculate Bill</button>
                <div className={"tip-options"}>
                    <h3>Tip Options</h3>
                    {[12, 15, 18].map((percentage) => (
                        <button
                            key={percentage}
                            className={tipPercentage === percentage ? 'selected' : ''}
                            onClick={() => setTipPercentage(percentage)}
                        >
                            {percentage}% Tip
                        </button>
                    ))}
                </div>
                {isBillCalculated && bill && (
                    <div className="bill-display" ref={resultsRef}>
                        <h2>Bill</h2>
                        <ul>
                            {Object.entries(bill).map(([name, amount]) => (
                                <li key={name}>
                                    <img src={getAvatar(name)} alt={name} className="avatar-small" />
                                    {name}: ₪{amount.toFixed(0)}
                                </li>
                            ))}
                        </ul>
                        <div className="total-section">
                            <div className="stacked-avatars">{getAllAvatars()}Total: ₪{total.toFixed(0)}</div>
                            <div></div>
                        </div>
                        {totalWithTip && (
                            <div className="tip-display">
                                <h3>With Tip:</h3>
                                <ul>
                                    {Object.entries(totalWithTip).map(([name, amount]) => (
                                        <li key={name}>
                                            <img src={getAvatar(name)} alt={name} className="avatar-small" />
                                            {name}: ₪{amount}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DndProvider>
    );
}

export default App;;