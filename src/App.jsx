import {useState, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import {DndProvider, useDrag, useDrop} from 'react-dnd';
import {TouchBackend} from 'react-dnd-touch-backend';
import './App.css';
import {initializeApp} from 'firebase/app';
import {getDatabase, ref, child, get, set, update} from "firebase/database";

// Your Firebase configuration (replace with your actual Firebase project settings)
// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCOmZRiKRQxgOghlWWskYpqF2OGFUwQzkE",
    authDomain: "shareat-8afdb.firebaseapp.com",
    databaseURL: "https://shareat-8afdb-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "shareat-8afdb",
    storageBucket: "shareat-8afdb.firebasestorage.app",
    messagingSenderId: "299363111604",
    appId: "1:299363111604:web:220001ba1ba2d924b03de1"
};

// // Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
await updateActivePeople();

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

async function updateActivePeople() {
    try {
        // Fetch all people from Firebase
        const peopleSnapshot = await get(ref(db, 'people'));

        if (peopleSnapshot.exists()) {
            const peopleData = Object.values(peopleSnapshot.val()); // Convert to an array
            const peopleKeys = Object.keys(peopleSnapshot.val());   // Get their IDs

            // Find the person with the minimal index who is inactive
            const inactiveIndex = peopleData.findIndex(person => !person.isActive);

            if (inactiveIndex !== -1) {
                const personToActivateId = peopleKeys[inactiveIndex]; // Get the ID for the person

                // Update only the `isActive` flag for the person
                await update(ref(db, `people/${personToActivateId}`), {isActive: true});
                console.log(`Activated person with ID: ${personToActivateId}`);
            } else {
                console.log('No inactive person found');
            }
        } else {
            console.log('No people data found');
        }
    } catch (error) {
        console.error('Error updating active people:', error);
    }
}

function Person({name, id, avatar, onClick}) {
    const [{isDragging}, drag] = useDrag(() => ({
        type: ItemTypes.PERSON,
        item: {id},
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }));

    return (
        <div ref={drag} className="person" style={{opacity: isDragging ? 0.5 : 1}}>
            <img src={avatar} alt={name} className="avatar"/>
            {name}
            <button onClick={onClick}>Delete</button>
        </div>
    );
}

Person.propTypes = {
    name: PropTypes.string.isRequired,
    id: PropTypes.number.isRequired,
    avatar: PropTypes.string.isRequired,
};

function Dish({name, id, icon, price, dishPeople, people, onDrop, onRemove, onAddAll, onRemoveAll}) {
    const [{isOver}, drop] = useDrop(() => ({
        accept: ItemTypes.PERSON,
        drop: (item) => onDrop(item.id, id),
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }));

    return (
        <div ref={drop} className="dish" style={{backgroundColor: isOver ? 'lightgreen' : 'white'}}>
            <img src={icon} alt={name} className="dish-icon"/>
            <div>{name}</div>
            <div className="dish-price">₪{price.toFixed(2)}</div>
            <div className="dish-buttons">
                <button onClick={() => onRemoveAll(id)}>Restart</button>
                <button onClick={() => onAddAll(id)}>Everyone</button>
            </div>
            <div className="dish-people">
                {Array.isArray(dishPeople) && dishPeople.length > 0 ? (
                    dishPeople.map((personId) => {
                        const person = people.find((p) => p === personId); // Find the personId in the array
                        const fullPerson = person ? people.find((p) => p === personId) : null; // Retrieve the full person object
                        return fullPerson ? (
                            <div key={fullPerson.id} className="avatar-small-container">
                                <img src={fullPerson.avatar} alt={fullPerson.name} className="avatar-small"/>
                                <button className={"remove-people-button"}
                                        onClick={() => onRemove(fullPerson.id, id)}>Remove
                                </button>
                            </div>
                        ) : null;
                    })
                ) : (
                    ""
                )}
            </div>
        </div>
    );
}

Dish.propTypes = {
    name: PropTypes.string.isRequired,
    id: PropTypes.number.isRequired,
    icon: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    dishPeople: PropTypes.array,
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
    // take people and dishes from DB
    const [people, setPeople] = useState([]);
    const [dishes, setDishes] = useState([]);
    const [bill, setBill] = useState(null);
    const [total, setTotal] = useState(0);
    const [tipPercentage, setTipPercentage] = useState(12);
    const [totalWithTip, setTotalWithTip] = useState(null);
    const [isBillCalculated, setIsBillCalculated] = useState(false);
    const fetchData = async () => {
        try {
            const peopleSnapshot = await get(ref(db, 'people'));
            const dishesSnapshot = await get(ref(db, 'dishes'));
            if (peopleSnapshot.exists() && dishesSnapshot.exists()) {
                const peopleData = peopleSnapshot.val();

                // Filter for people who are active (isActive: true)
                const activePeople = Object.values(peopleData).filter(person => person.isActive);

                setPeople(Object.values(activePeople));
                setDishes(Object.values(dishesSnapshot.val()));
            }
        } catch (error) {
            console.error("Error fetching data from Firebase", error);
        }
    };

    // useEffect(() => {
    //     // Define the fetch interval (e.g., every 5 seconds)
    //     const fetchInterval = 5000;
    //
    //     // Function to fetch data
    //     const fetchDataInterval = async () => {
    //         await fetchData();
    //     };
    //
    //     // Set an interval to fetch data every `fetchInterval` milliseconds
    //     const intervalId = setInterval(fetchDataInterval, fetchInterval);
    //
    //     // Cleanup the interval when the component unmounts
    //     return () => {
    //         clearInterval(intervalId);
    //     };
    // }, []);

    const resultsRef = useRef(null);
    // Fetch people and dishes from Firebase Realtime Database
    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        calculateBill();
    }, [dishes, tipPercentage]);

    useEffect(() => {
        const fetchDataInterval = async () => {
            try {
                const peopleSnapshot = await get(ref(db, 'people'));
                const dishesSnapshot = await get(ref(db, 'dishes'));

                if (peopleSnapshot.exists() && dishesSnapshot.exists()) {
                    const peopleData = peopleSnapshot.val();

                    // Filter for people who are active (isActive: true)
                    const activePeople = Object.values(peopleData).filter(person => person.isActive);
                    const newDishesData = Object.values(dishesSnapshot.val());

                    // Compare new data with current state
                    const isPeopleDifferent = JSON.stringify(activePeople) !== JSON.stringify(people);
                    const isDishesDifferent = JSON.stringify(newDishesData) !== JSON.stringify(dishes);

                    // Update state only if there is a difference
                    if (isPeopleDifferent) {
                        setPeople(activePeople);
                    }
                    if (isDishesDifferent) {
                        setDishes(newDishesData);
                    }
                }
            } catch (error) {
                console.error("Error fetching data from Firebase", error);
            }
        };

        const intervalId = setInterval(fetchDataInterval, 1000); // Fetch every second

        return () => clearInterval(intervalId);
    }, [people, dishes]);

    const handleDrop = async (personId, dishId) => {
        await appendDishWithIdInFirebase(personId, dishId);
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.id === dishId
                    ? {
                        ...dish,
                        people: dish.people
                            ? dish.people.includes(personId)
                                ? dish.people
                                : [...dish.people, personId]
                            : [personId] // Initialize with the personId if dish.people is null or undefined
                    }
                    : dish
            )
        );
    };

    const handleRemove = async (personId, dishId) => {
        await removePersonFromDishInFirebase(personId, dishId);
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.id === dishId
                    ? {
                        ...dish,
                        // Ensure dish.people is an array and filter out personId
                        people: Array.isArray(dish.people)
                            ? dish.people.filter((id) => id !== personId)
                            : []  // If dish.people is not an array, set it to an empty array
                    }
                    : dish
            )
        );
    };


    const handleAddAll = async (dishId) => {
        const allPersonIds = people.map((person) => person.id);
        for (const personId of allPersonIds) {
            await appendDishWithIdInFirebase(personId, dishId);
        }
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.id === dishId
                    ? {
                        ...dish,
                        people: allPersonIds
                    }
                    : dish
            )
        );
    };

    const handleRemoveAll = async (dishId) => {
        const dish = dishes.find((dish) => dish.id === dishId);
        if (dish && dish.people) {
            for (const personId of dish.people) {
                await removePersonFromDishInFirebase(personId, dishId);
            }
        }
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.id === dishId
                    ? {
                        ...dish,
                        people: []
                    }
                    : dish
            )
        );
    };

    const calculateBill = () => {
        const bill = people.reduce((acc, personId) => {
            const person = people.find((p) => p === personId); // Get the full person object by ID
            // console.log(person)
            if (!person) return acc; // If person is not found, skip the calculation for this person

            const total = dishes.reduce((sum, dish) => {
                const peopleInDish = dish.people || []; // Default to an empty array if dish.people is null/undefined

                const personCount = peopleInDish.length;
                if (personCount > 0 && peopleInDish.some((p) => p === person.id)) {
                    return sum + dish.price / personCount;
                }
                return sum;
            }, 0);
            return {...acc, [person.name]: total};
        }, {});

        const totalAmount = Object.values(bill).reduce((sum, amount) => sum + amount, 0);
        const unselectedDishesTotal = dishes.reduce((sum, dish) => {
            const peopleInDish = dish.people || []; // Default to an empty array if dish.people is null/undefined
            return peopleInDish.length === 0 ? sum + dish.price : sum;
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
            return {...acc, [name]: (amount + tipAmount).toFixed(0)};
        }, {});
        setTotalWithTip(totalWithTip);
    };

    const handleCalculateBill = () => {
        // console.log("handling bill");
        // setDishes((dishes) =>
        //     dishes.map((dish) => {
        //         // Ensure dish.people is an array and check if it's empty
        //         const dishPeople = Array.isArray(dish.people) ? dish.people : [];
        //
        //         // If dish.people is empty, replace it with the people list
        //         return dishPeople.length === 0 ? { ...dish, people: people } : dish;
        //     })
        // );
        calculateBill();
        setIsBillCalculated(true);
        setTimeout(() => {
            resultsRef.current.scrollIntoView({behavior: 'smooth'});
        }, 0);
    };

    const updateDishesInFirebase = async (prevDishes) => {
        try {
            // Ensure dishes is an object or array as expected by Firebase
            if (Array.isArray(prevDishes)) {
                console.log(prevDishes)
                // If dishes is an array, we'll convert it into an object by using the IDs as keys
                const dishesObject = prevDishes.reduce((acc, dish) => {
                    acc[dish.id] = dish;  // Assuming each dish has an `id` property
                    return acc;
                }, {});

                // Send the data to Firebase
                await set(ref(db, 'dishes'), dishesObject);
            } else {
                // If dishes is already an object, just send it directly
                await set(ref(db, 'dishes'), dishes);
            }

            console.log("Dishes successfully updated to Firebase.");
        } catch (error) {
            console.error("Error updating dishes to Firebase", error);
        }
    };

    const appendDishWithIdInFirebase = async (personID, dishID) => {
        try {
            // Get the current dish data from Firebase
            const dishRef = ref(db, `dishes/${dishID}`);
            const dishSnapshot = await get(dishRef);

            if (dishSnapshot.exists()) {
                const dishData = dishSnapshot.val();
                const updatedPeople = dishData.people ? [...dishData.people] : [];

                // Append personID only if it's not already in the array
                if (!updatedPeople.includes(personID)) {
                    updatedPeople.push(personID);

                    // Update the dish's people array in Firebase
                    await update(dishRef, { people: updatedPeople });
                    console.log(`Person with ID ${personID} added to dish with ID ${dishID}`);
                } else {
                    console.log(`Person with ID ${personID} is already in the dish with ID ${dishID}`);
                }
            } else {
                console.log(`Dish with ID ${dishID} not found`);
            }
        } catch (error) {
            console.error("Error appending person to dish in Firebase:", error);
        }
    };

    const removePersonFromDishInFirebase = async (personID, dishID) => {
        try {
            // Get the current dish data from Firebase
            const dishRef = ref(db, `dishes/${dishID}`);
            const dishSnapshot = await get(dishRef);

            if (dishSnapshot.exists()) {
                const dishData = dishSnapshot.val();
                const updatedPeople = dishData.people ? dishData.people.filter(id => id !== personID) : [];

                // Update the dish's people array in Firebase
                await update(dishRef, { people: updatedPeople });
                console.log(`Person with ID ${personID} removed from dish with ID ${dishID}`);
            } else {
                console.log(`Dish with ID ${dishID} not found`);
            }
        } catch (error) {
            console.error("Error removing person from dish in Firebase:", error);
        }
    };

    async function handlePeopleRemoval(personId) {
        try {
            // 1. Mark the person as non-active in Firebase
            await update(ref(db, `people/${personId}`), { isActive: false });
            console.log(`Person with ID ${personId} marked as non-active`);

            // 2. Remove the person from all dishes in Firebase
            const dishesSnapshot = await get(ref(db, 'dishes'));
            if (dishesSnapshot.exists()) {
                const dishesData = dishesSnapshot.val();
                const updatedDishes = Object.keys(dishesData).map(dishId => {
                    const dish = dishesData[dishId];
                    const updatedPeople = dish.people ? dish.people.filter(id => id !== personId) : [];
                    return {
                        ...dish,
                        people: updatedPeople,
                    };
                });

                // Update dishes in Firebase
                await update(ref(db, 'dishes'), updatedDishes.reduce((acc, dish, index) => {
                    acc[`/${index}`] = dish;
                    return acc;
                }, {}));
                console.log(`Person with ID ${personId} removed from all dishes`);
            }

            // 3. Fetch updated data
            await fetchData();
        } catch (error) {
            console.error("Error marking person as non-active or removing from dishes:", error);
        }
    }


    const getAvatar = (name) => {
        const person = people.find((p) => p.name === name);
        return person ? person.avatar : '';
    };
    const getAllAvatars = () => {
        return people.map((person) => (
            <img key={person.id} src={person.avatar} alt={person.name} className="avatar-small stacked-avatar"/>
        ));
    };

    return (
        <DndProvider backend={TouchBackend} options={{enableMouseEvents: true}}>
            <div className="app">
                <img src="logo2.webp" alt="logo" className="logo"/>
                <h2>Drag people to dishes they had</h2>
                <div className="people">
                    {people.map((person) => (

                        <Person
                            key={person.id}
                            id={person.id}
                            name={person.name}
                            avatar={person.avatar}
                            onClick={() => handlePeopleRemoval(person.id)}
                        />

                    ))}
                </div>
                <div className="dishes">
                    {dishes.map((dish) => {
                        // Prepare the full people objects for this dish before passing them to Dish
                        const dishPeopleObjects = dish.people && Array.isArray(dish.people)
                            ? dish.people.map((personId) => people.find((p) => p.id === personId))
                            : []; // If dish.people is null or not an array, return an empty array                 console.log(dishPeopleObjects)
                        return (
                            <Dish
                                key={dish.id}
                                id={dish.id}
                                name={dish.name}
                                icon={dish.icon}
                                price={dish.price}
                                people={people} // Pass the full people data
                                dishPeople={dishPeopleObjects} // Pass the full person objects for this dish
                                onDrop={handleDrop}
                                onRemove={handleRemove}
                                onAddAll={handleAddAll}
                                onRemoveAll={handleRemoveAll}
                            />
                        );
                    })}
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
                                    <img src={getAvatar(name)} alt={name} className="avatar-small"/>
                                    {name}: ₪{amount.toFixed(2)}
                                </li>
                            ))}
                        </ul>
                        <div className="total-section">
                            <div className="stacked-avatars">{getAllAvatars()}Total: ₪{total.toFixed(2)}</div>
                            <div></div>
                        </div>
                        {totalWithTip && (
                            <div className="tip-display">
                                <h3>With Tip:</h3>
                                <ul>
                                    {Object.entries(totalWithTip).map(([name, amount]) => (
                                        <li key={name}>
                                            <img src={getAvatar(name)} alt={name} className="avatar-small"/>
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

export default App;
;
